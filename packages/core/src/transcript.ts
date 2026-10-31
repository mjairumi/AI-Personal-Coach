import type { TranscriptTurn } from "./types.ts";

/**
 * Bolna returns transcripts as a single string, e.g.
 *   "assistant: Hi there!\nuser: Hello\nassistant: ..."
 * Lines without a speaker prefix are appended to the previous turn.
 */
export function parseTranscript(raw: unknown): TranscriptTurn[] {
  if (Array.isArray(raw)) {
    return raw
      .map((t: any) => ({
        role: /user|human|caller/i.test(String(t?.role ?? t?.speaker ?? "")) ? "user" : "coach",
        text: String(t?.content ?? t?.text ?? "").trim(),
      }))
      .filter((t) => t.text) as TranscriptTurn[];
  }
  if (typeof raw !== "string" || !raw.trim()) return [];
  const turns: TranscriptTurn[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*(assistant|agent|bot|ai|user|human|caller|customer)\s*:\s*(.*)$/i);
    if (m) {
      const role = /assistant|agent|bot|ai/i.test(m[1]) ? "coach" : "user";
      const text = m[2].trim();
      const prev = turns[turns.length - 1];
      if (prev && prev.role === role) prev.text = `${prev.text} ${text}`.trim();
      else turns.push({ role, text });
    } else if (line.trim() && turns.length) {
      turns[turns.length - 1].text += ` ${line.trim()}`;
    }
  }
  return turns.filter((t) => t.text);
}

export function transcriptToText(turns: TranscriptTurn[]): string {
  return turns.map((t) => `${t.role === "coach" ? "Coach" : "User"}: ${t.text}`).join("\n");
}
