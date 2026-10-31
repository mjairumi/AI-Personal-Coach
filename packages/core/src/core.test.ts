import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTranscript } from "./transcript.ts";
import { normalizeInsights, extractJsonObject } from "./insights.ts";
import { buildMemory, computeStats } from "./memory.ts";
import type { CoachingSession } from "./types.ts";

test("parseTranscript handles Bolna string format", () => {
  const t = parseTranscript("assistant: Hi Sam!\nuser: Hello\nuser: I feel stuck.\nassistant: Tell me more.\ncontinued line");
  assert.deepEqual(t, [
    { role: "coach", text: "Hi Sam!" },
    { role: "user", text: "Hello I feel stuck." },
    { role: "coach", text: "Tell me more. continued line" },
  ]);
});

test("extractJsonObject handles fenced JSON", () => {
  assert.deepEqual(extractJsonObject('```json\n{"a":1}\n```'), { a: 1 });
});

test("normalizeInsights maps snake_case + clamps scores", () => {
  const i = normalizeInsights(
    { summary: "You explored X.", key_insights: ["a"], action_items: "- call mom\n- run 3x", mood_score: "14" },
    "llm",
  )!;
  assert.equal(i.summary, "You explored X.");
  assert.deepEqual(i.actionItems, ["call mom", "run 3x"]);
  assert.equal(i.moodScore, 10);
  assert.equal(normalizeInsights({ foo: 1 }, "llm"), null);
});

const mk = (o: Partial<CoachingSession>): CoachingSession => ({
  id: "x", userId: "u", userName: "Sam", modeId: "career", goal: "", status: "ready",
  createdAt: new Date().toISOString(), transcript: [], ...o,
});

test("buildMemory includes summaries and commitments", () => {
  assert.match(buildMemory([]), /first session/);
  const m = buildMemory([mk({ insights: { summary: "You weighed a job offer.", keyInsights: [], actionItems: ["Email recruiter by Friday"], source: "llm" } })]);
  assert.match(m, /job offer/);
  assert.match(m, /Email recruiter/);
});

test("computeStats streak counts consecutive days", () => {
  const today = new Date();
  const y = new Date(today); y.setDate(y.getDate() - 1);
  const s = computeStats([mk({ createdAt: today.toISOString(), durationSec: 120 }), mk({ createdAt: y.toISOString(), durationSec: 60 })]);
  assert.equal(s.streakDays, 2);
  assert.equal(s.totalMinutes, 3);
});
