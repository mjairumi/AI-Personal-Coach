import fs from "node:fs";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { buildMemory, computeStats, getMode, isModeId, type CoachingSession } from "@disha/core";
import { config, insightsProvider } from "./config.ts";
import { BolnaError, mintWebCallSession } from "./bolna.ts";
import { createStore } from "./store.ts";
import { applyExecution, refreshSession } from "./sessions.ts";

const store = await createStore(config.databaseUrl, config.dataFile);
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
if (config.corsOrigins.length) app.use(cors({ origin: config.corsOrigins }));

const asyncH =
  (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

/** Anonymous device/user id (UUID kept in localStorage / device storage). Swap for real auth later. */
function userIdOf(req: Request): string | null {
  const id = String(req.header("x-user-id") ?? req.body?.userId ?? "").trim();
  return /^[A-Za-z0-9_-]{8,64}$/.test(id) ? id : null;
}

const clean = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    bolnaConfigured: Boolean(config.bolnaApiKey && config.bolnaAgentId),
    insightsProvider,
    storage: store.kind,
  });
});

// Simple per-user throttle on minting so one tab can't burn through concurrency.
const lastMint = new Map<string, number>();

/**
 * Mint a Bolna web-call session. The browser never sees the bn- API key:
 * it gets a single-use SIP credential (~120s TTL) for exactly one call.
 */
app.post(
  "/api/bolna-session",
  asyncH(async (req, res) => {
    if (!config.bolnaApiKey || !config.bolnaAgentId) {
      return res.status(503).json({ error: "Server is missing BOLNA_API_KEY / BOLNA_AGENT_ID." });
    }
    const userId = userIdOf(req);
    if (!userId) return res.status(400).json({ error: "Missing or invalid user id." });
    if (Date.now() - (lastMint.get(userId) ?? 0) < 4000) {
      return res.status(429).json({ error: "Please wait a moment before starting another session." });
    }
    lastMint.set(userId, Date.now());

    const mode = getMode(isModeId(req.body?.modeId) ? req.body.modeId : "life");
    const userName = clean(req.body?.userName, 40) || "friend";
    const goal = clean(req.body?.goal, 300);
    const history = await store.listByUser(userId);

    const userData = {
      user_name: userName,
      coach_mode: mode.promptLabel,
      mode_guidance: mode.guidance,
      session_goal: goal || "They haven't said yet — gently ask what they'd like to focus on today.",
      memory: buildMemory(history),
    };

    let minted: any;
    try {
      minted = await mintWebCallSession(userData);
    } catch (e) {
      if (e instanceof BolnaError) {
        console.error("[mint] Bolna rejected:", e.status, e.body);
        const status = e.status === 429 ? 429 : e.status === 401 || e.status === 403 ? 502 : e.status >= 500 ? 502 : e.status;
        const detail = (e.body as any)?.detail ?? (e.body as any)?.message ?? (e.body as any)?.error;
        return res.status(status).json({
          error:
            e.status === 429
              ? "All coaching lines are busy right now — please try again in a minute."
              : `Could not start a voice session${detail ? `: ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : "."}`,
          scope: (e.body as any)?.scope,
        });
      }
      throw e;
    }

    if (minted?.run_id) {
      const session: CoachingSession = {
        id: String(minted.run_id),
        userId,
        userName,
        modeId: mode.id,
        goal,
        status: "live",
        createdAt: new Date().toISOString(),
        transcript: [],
      };
      await store.upsert(session);
    }
    res.json(minted);
  }),
);

async function ownedSession(req: Request, res: Response): Promise<CoachingSession | null> {
  const userId = userIdOf(req);
  const s = await store.get(req.params.id);
  if (!s || !userId || s.userId !== userId) {
    res.status(404).json({ error: "Session not found." });
    return null;
  }
  return s;
}

app.get(
  "/api/sessions",
  asyncH(async (req, res) => {
    const userId = userIdOf(req);
    if (!userId) return res.status(400).json({ error: "Missing user id." });
    let sessions = await store.listByUser(userId);
    // Opportunistically refresh any sessions still waiting on Bolna.
    const pending = sessions.filter((s) => s.status === "live" || s.status === "processing").slice(0, 3);
    if (pending.length) {
      await Promise.all(pending.map((s) => refreshSession(store, s)));
      sessions = await store.listByUser(userId);
    }
    // Hide empty/abandoned sessions (no conversation captured).
    const visible = sessions.filter((s) => s.status !== "failed" && !(s.status === "ready" && s.transcript.length === 0 && !s.insights?.summary));
    res.json({ sessions: visible, stats: computeStats(visible) });
  }),
);

app.get(
  "/api/sessions/:id",
  asyncH(async (req, res) => {
    const s = await ownedSession(req, res);
    if (!s) return;
    res.json(await refreshSession(store, s));
  }),
);

/** Called by the browser when the call ends — moves the session into "processing". */
app.post(
  "/api/sessions/:id/end",
  asyncH(async (req, res) => {
    const s = await ownedSession(req, res);
    if (!s) return;
    if (s.status === "live") {
      s.status = "processing";
      s.endedAt = new Date().toISOString();
      const d = Number(req.body?.durationSec);
      if (Number.isFinite(d) && d > 0) s.durationSec = Math.round(d);
      await store.upsert(s);
    }
    res.json(s);
  }),
);

app.delete(
  "/api/sessions/:id",
  asyncH(async (req, res) => {
    const s = await ownedSession(req, res);
    if (!s) return;
    await store.delete(s.id);
    res.json({ ok: true });
  }),
);

/**
 * Bolna webhook: set the agent's webhook URL to https://<your-host>/api/webhooks/bolna?token=WEBHOOK_TOKEN
 * Bolna posts execution updates (status, transcript, summary, extracted_data) here.
 */
app.post(
  "/api/webhooks/bolna",
  asyncH(async (req, res) => {
    if (config.webhookToken && req.query.token !== config.webhookToken) return res.status(401).json({ error: "bad token" });
    const exec = req.body ?? {};
    const id = String(exec.id ?? exec.execution_id ?? exec.run_id ?? "");
    const s = id ? await store.get(id) : undefined;
    if (s) await applyExecution(store, s, exec);
    res.json({ ok: true, matched: Boolean(s) });
  }),
);

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

// Serve the built web app (single deployable). In dev, Vite serves the frontend and proxies /api.
if (fs.existsSync(config.webDist)) {
  app.use(express.static(config.webDist, { index: false, maxAge: "1h" }));
  app.get("*", (_req, res) => res.sendFile(path.join(config.webDist, "index.html")));
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[server] error", err);
  res.status(500).json({ error: "Something went wrong." });
});

app.listen(config.port, () => {
  console.log(`Disha server listening on http://localhost:${config.port}`);
  if (!config.bolnaApiKey || !config.bolnaAgentId) console.warn("⚠  BOLNA_API_KEY / BOLNA_AGENT_ID not set — voice sessions will fail.");
  console.log(`Insights provider: ${insightsProvider} · Storage: ${store.kind}`);
});
