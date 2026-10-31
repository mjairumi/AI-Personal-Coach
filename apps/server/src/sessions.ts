import { normalizeInsights, parseTranscript, type CoachingSession } from "@disha/core";
import { getExecution, TERMINAL_STATUSES } from "./bolna.ts";
import { generateInsights } from "./llm.ts";
import type { Store } from "./store.ts";

const lastFetch = new Map<string, number>();
const inflight = new Map<string, Promise<CoachingSession>>();
/** Give up waiting on Bolna after this long and show whatever we have. */
const PROCESSING_TIMEOUT_MS = 4 * 60_000;

function num(...vals: unknown[]): number | undefined {
  for (const v of vals) {
    const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return undefined;
}

/** Merge a Bolna execution payload (from GET /executions/:id or the webhook) into our session. */
export async function applyExecution(store: Store, session: CoachingSession, exec: any): Promise<CoachingSession> {
  const s: CoachingSession = { ...session };
  const status = String(exec?.status ?? exec?.smart_status ?? "").toLowerCase();
  if (status) s.bolnaStatus = status;

  const turns = parseTranscript(exec?.transcript);
  if (turns.length >= s.transcript.length) s.transcript = turns;

  s.durationSec =
    num(exec?.conversation_time, exec?.conversation_duration, exec?.telephony_data?.duration) ?? s.durationSec;

  const terminal = TERMINAL_STATUSES.has(status);
  const timedOut = Date.now() - new Date(s.endedAt ?? s.createdAt).getTime() > PROCESSING_TIMEOUT_MS;

  if (s.status === "live" && terminal) {
    s.status = "processing";
    s.endedAt ??= new Date().toISOString();
  }

  if (s.status === "processing" && (terminal || timedOut)) {
    if (!s.insights || s.insights.source === "none" || s.insights.source === "bolna-summary") {
      const extracted = normalizeInsights(exec?.extracted_data, "bolna-extraction");
      const llm = extracted ? null : await generateInsights(s.transcript, s.goal);
      const summary = typeof exec?.summary === "string" && exec.summary.trim() ? exec.summary.trim() : undefined;
      s.insights = extracted ??
        llm ?? {
          summary,
          keyInsights: [],
          actionItems: [],
          source: summary ? "bolna-summary" : "none",
        };
      // Bolna's summary usually lands a little after the transcript — wait for it (until timeout).
      if (s.insights.source === "none" && !timedOut && s.transcript.length > 1) return store.upsert(s);
    }
    s.status = "ready";
  }
  return store.upsert(s);
}

/** Pull the latest state from Bolna for a session that isn't finished yet (throttled + de-duplicated). */
export async function refreshSession(store: Store, session: CoachingSession): Promise<CoachingSession> {
  if (session.status === "ready" || session.status === "failed") return session;
  const last = lastFetch.get(session.id) ?? 0;
  if (Date.now() - last < 2500) return session;
  const existing = inflight.get(session.id);
  if (existing) return existing;

  const p = (async () => {
    lastFetch.set(session.id, Date.now());
    try {
      const exec = await getExecution(session.id);
      return await applyExecution(store, session, exec);
    } catch (e: any) {
      // 404 right after the call is normal (execution not written yet).
      if (e?.status !== 404) console.warn(`[sessions] refresh ${session.id} failed:`, e?.status ?? e, e?.body ?? "");
      const age = Date.now() - new Date(session.createdAt).getTime();
      // Minted but never connected (mic denied, tab closed before answer) — drop it quietly.
      if (session.status === "live" && age > 20 * 60_000) {
        return store.upsert({ ...session, status: "failed" });
      }
      if (session.status === "processing" && Date.now() - new Date(session.endedAt ?? session.createdAt).getTime() > PROCESSING_TIMEOUT_MS) {
        return store.upsert({ ...session, status: "ready", insights: session.insights ?? { keyInsights: [], actionItems: [], source: "none" } });
      }
      return session;
    } finally {
      inflight.delete(session.id);
    }
  })();
  inflight.set(session.id, p);
  return p;
}
