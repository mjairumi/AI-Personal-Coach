import type { CoachMode, CoachModeId } from "./types.ts";

export const COACH_MODES: CoachMode[] = [
  {
    id: "life",
    title: "Life Coach",
    tagline: "Clarity on goals, habits, balance and what truly matters to you.",
    emoji: "🌱",
    promptLabel: "Life coaching",
    guidance:
      "Help the user get clear on what they want from life, their values, habits, relationships and balance. Explore where they feel stuck and help them design small, sustainable changes.",
    starters: [
      "I feel stuck and don't know what I want",
      "I want to build better habits",
      "My work-life balance is off",
      "I want to set goals for next year",
    ],
    accent: "#34d399",
  },
  {
    id: "career",
    title: "Career Coach",
    tagline: "Navigate job changes, growth, interviews and your professional path.",
    emoji: "🚀",
    promptLabel: "Career coaching",
    guidance:
      "Act as an experienced career mentor. Help with career direction, switching roles or industries, promotions, salary negotiation, interview preparation, workplace conflicts, leadership and building skills. Ask about their strengths, experience and what energises them. Give concrete, practical advice when asked.",
    starters: [
      "Should I switch jobs?",
      "Help me prepare for an interview",
      "How do I ask for a promotion?",
      "I'm confused about my career path",
    ],
    accent: "#60a5fa",
  },
  {
    id: "personality",
    title: "Personality Coach",
    tagline: "Build confidence, self-awareness and how you show up with others.",
    emoji: "✨",
    promptLabel: "Personality and confidence coaching",
    guidance:
      "Help the user grow self-awareness, confidence, communication skills, emotional intelligence and presence. Explore their strengths, blind spots and patterns in how they react to people and situations. Suggest small real-world practice exercises.",
    starters: [
      "I want to be more confident",
      "I struggle with public speaking",
      "I overthink everything",
      "How do I handle criticism better?",
    ],
    accent: "#f472b6",
  },
  {
    id: "decision",
    title: "Decision Coach",
    tagline: "Think through a tough choice with structure — without the overwhelm.",
    emoji: "🧭",
    promptLabel: "Decision making coaching",
    guidance:
      "Guide the user through a structured decision. First clarify the exact decision and deadline. Then surface the options (including ones they have not considered), their values and criteria, and the risks. Use tools like the 10-10-10 rule, best and worst case, a pre-mortem, and 'what would you advise a friend'. Help them reach a decision they feel at peace with, or a clear next step to get more information.",
    starters: [
      "Job offer vs. staying put",
      "Should I do a master's degree?",
      "Should I move to a new city?",
      "Start a business or stay employed?",
    ],
    accent: "#fbbf24",
  },
  {
    id: "reflection",
    title: "Daily Reflection",
    tagline: "A 5-minute voice journal to reflect on your day and actions.",
    emoji: "🌙",
    promptLabel: "Daily reflection check-in",
    guidance:
      "Run a short, gentle daily reflection of about five minutes. Ask how their day went, what went well, what was challenging, how they acted and how they felt about it, what they learned, and one thing they will do differently tomorrow. Keep it light and encouraging.",
    starters: [
      "Reflect on my day",
      "Something happened today I want to process",
      "I reacted badly to someone today",
      "I had a great win today",
    ],
    accent: "#a78bfa",
  },
];

export function getMode(id: string | undefined | null): CoachMode {
  return COACH_MODES.find((m) => m.id === id) ?? COACH_MODES[0];
}

export function isModeId(id: unknown): id is CoachModeId {
  return typeof id === "string" && COACH_MODES.some((m) => m.id === id);
}
