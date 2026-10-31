import type { SessionInsights } from "./types.ts";

function toStrArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(typeof x === "object" && x ? Object.values(x).join(" — ") : x).trim()).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    return v
      .split(/\n|;|•/)
      .map((s) => s.replace(/^\s*[-*\d.)]+\s*/, "").trim())
      .filter(Boolean);
  }
  return [];
}

function toScore(v: unknown): number | null {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(10, Math.round(n)));
}

/** Pull the first JSON object out of a string (handles ```json fences and chatter). */
export function extractJsonObject(input: unknown): Record<string, unknown> | null {
  if (input && typeof input === "object" && !Array.isArray(input)) return input as Record<string, unknown>;
  if (typeof input !== "string") return null;
  const s = input.trim();
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === "object") return parsed;
    if (typeof parsed === "string") return extractJsonObject(parsed);
  } catch {
    /* fall through */
  }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(s.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

/** Normalise any loosely-shaped insight object (Bolna extraction, LLM output) into SessionInsights. */
export function normalizeInsights(raw: unknown, source: SessionInsights["source"]): SessionInsights | null {
  const o = extractJsonObject(raw);
  if (!o) return null;
  // Bolna extraction sometimes nests results one level down.
  const obj = (Object.keys(o).length === 1 && typeof Object.values(o)[0] === "object" ? Object.values(o)[0] : o) as Record<string, any>;
  const insights: SessionInsights = {
    title: obj.title ? String(obj.title) : undefined,
    summary: obj.summary ? String(obj.summary) : undefined,
    keyInsights: toStrArray(obj.key_insights ?? obj.keyInsights ?? obj.insights),
    actionItems: toStrArray(obj.action_items ?? obj.actionItems ?? obj.next_steps),
    mood: obj.mood ? String(obj.mood) : undefined,
    moodScore: toScore(obj.mood_score ?? obj.moodScore),
    confidenceScore: toScore(obj.confidence_score ?? obj.confidenceScore),
    followUp: obj.follow_up ?? obj.followUp ? String(obj.follow_up ?? obj.followUp) : undefined,
    memory: obj.memory ? String(obj.memory) : undefined,
    source,
  };
  const hasContent = insights.summary || insights.keyInsights.length || insights.actionItems.length;
  return hasContent ? insights : null;
}

export const INSIGHTS_INSTRUCTIONS = `You analyse a voice coaching conversation between an AI coach ("Coach") and a user ("User").
Return ONLY a JSON object with exactly these keys:
- "title": short 3-6 word title for the session.
- "summary": 2-3 sentence summary of what the user discussed and realised, addressed to the user in second person ("You ...").
- "key_insights": array of 1-4 short strings — the most important realisations or patterns.
- "action_items": array of 0-3 short strings — concrete next steps the user committed to (include timeframe if mentioned).
- "mood": one word for the user's emotional state at the end.
- "mood_score": integer 1-10 (10 = very positive).
- "confidence_score": integer 1-10 the user gave for following through, or null.
- "follow_up": one question the coach should open the next session with.
- "memory": 1-2 sentences of durable facts about the user worth remembering (goals, context, preferences).
Only use facts present in the conversation.`;
