import { INSIGHTS_INSTRUCTIONS, normalizeInsights, transcriptToText, type SessionInsights, type TranscriptTurn } from "@disha/core";
import { config, insightsProvider } from "./config.ts";

/**
 * Optional: turn the call transcript into structured insights with an LLM.
 * Returns null when no provider key is configured or the call fails (we then fall back to Bolna's summary).
 */
export async function generateInsights(turns: TranscriptTurn[], goal: string): Promise<SessionInsights | null> {
  if (insightsProvider === "bolna" || !turns.length) return null;
  const convo = `User's stated goal for the session: ${goal || "(not specified)"}\n\nConversation:\n${transcriptToText(turns)}`;
  try {
    if (insightsProvider === "gemini") {
      // Google AI Studio (Gemini API) key — https://aistudio.google.com/apikey
      const model = process.env.INSIGHTS_MODEL || "gemini-2.5-flash";
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": config.geminiApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: INSIGHTS_INSTRUCTIONS }] },
          contents: [{ role: "user", parts: [{ text: convo }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
        }),
      });
      if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
      const data: any = await res.json();
      const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
      return normalizeInsights(text, "llm");
    }
    if (insightsProvider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": config.anthropicApiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.INSIGHTS_MODEL || "claude-haiku-5-5",
          max_tokens: 1024,
          system: INSIGHTS_INSTRUCTIONS,
          messages: [{ role: "user", content: convo }],
        }),
      });
      if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
      const data: any = await res.json();
      const text = (data.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
      return normalizeInsights(text, "llm");
    }
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.openaiApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.INSIGHTS_MODEL || "gpt-4.1-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: INSIGHTS_INSTRUCTIONS },
          { role: "user", content: convo },
        ],
      }),
    });
    if (!res.ok) throw new Error(`openai ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    return normalizeInsights(data.choices?.[0]?.message?.content, "llm");
  } catch (e) {
    console.error("[insights] LLM generation failed:", e);
    return null;
  }
}
