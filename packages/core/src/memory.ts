import { getMode } from "./modes.ts";
import type { CoachingSession, UserStats } from "./types.ts";

/**
 * Build the {memory} variable injected into the agent prompt, from the user's most recent sessions.
 * Kept short so it fits comfortably into the voice agent's context and stays fast.
 */
export function buildMemory(sessions: CoachingSession[], maxChars = 1200): string {
  const done = sessions
    .filter((s) => s.status === "ready" && (s.insights?.summary || s.insights?.memory))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);
  if (!done.length) return "This is your first session together, so get to know them warmly.";

  const parts: string[] = [];
  for (const s of done) {
    const when = relativeDay(s.createdAt);
    const i = s.insights!;
    let p = `${when} (${getMode(s.modeId).title}): ${i.summary ?? ""}`.trim();
    if (i.memory) p += ` Notes: ${i.memory}`;
    if (i.actionItems.length) p += ` They committed to: ${i.actionItems.join("; ")}.`;
    if (i.followUp) p += ` Suggested follow-up: ${i.followUp}`;
    parts.push(p);
  }
  let out = parts.join(" | ");
  if (out.length > maxChars) out = out.slice(0, maxChars - 1) + "…";
  return out;
}

export function relativeDay(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const days = Math.floor((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days <= 0) return "Earlier today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function computeStats(sessions: CoachingSession[], now = new Date()): UserStats {
  const real = sessions.filter((s) => s.status !== "failed");
  const totalSeconds = real.reduce((a, s) => a + (s.durationSec ?? 0), 0);
  const moods = real.map((s) => s.insights?.moodScore).filter((n): n is number => typeof n === "number");

  const days = new Set(real.map((s) => new Date(startOfDay(new Date(s.createdAt))).toDateString()));
  let streak = 0;
  const cursor = new Date(startOfDay(now));
  if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    totalSessions: real.length,
    totalMinutes: Math.round(totalSeconds / 60),
    streakDays: streak,
    openActionItems: real.reduce((a, s) => a + (s.insights?.actionItems.length ?? 0), 0),
    avgMood: moods.length ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10 : null,
  };
}
