/** Shared domain types — used by the web app, the server, and (later) the mobile app. */

export type CoachModeId = "life" | "career" | "personality" | "decision" | "reflection";

export interface CoachMode {
  id: CoachModeId;
  title: string;
  tagline: string;
  emoji: string;
  /** Short label substituted into the agent prompt as {coach_mode}. */
  promptLabel: string;
  /** Guidance substituted into the agent prompt as {mode_guidance}. */
  guidance: string;
  /** Quick-start topics shown as chips. */
  starters: string[];
  accent: string;
}

export type SessionStatus = "live" | "processing" | "ready" | "failed";

export interface TranscriptTurn {
  role: "coach" | "user";
  text: string;
}

export interface SessionInsights {
  title?: string;
  summary?: string;
  keyInsights: string[];
  actionItems: string[];
  mood?: string;
  moodScore?: number | null;
  confidenceScore?: number | null;
  followUp?: string;
  memory?: string;
  /** Where the insights came from. */
  source: "bolna-extraction" | "llm" | "bolna-summary" | "none";
}

export interface CoachingSession {
  /** Bolna run_id / execution id. */
  id: string;
  userId: string;
  userName: string;
  modeId: CoachModeId;
  goal: string;
  status: SessionStatus;
  createdAt: string;
  endedAt?: string;
  durationSec?: number;
  transcript: TranscriptTurn[];
  insights?: SessionInsights;
  /** Raw Bolna execution status, for debugging. */
  bolnaStatus?: string;
}

export interface UserProfile {
  id: string;
  name: string;
}

/** Body of POST /api/bolna-session */
export interface StartSessionRequest {
  userId: string;
  userName: string;
  modeId: CoachModeId;
  goal?: string;
}

/** Ephemeral Bolna web-call session (mint response). Single-use, ~120s TTL. */
export interface BolnaWebSession {
  run_id: string;
  agent_id: string;
  sip_username: string;
  sip_password: string;
  sip_domain: string;
  wss_url: string;
  sip_register: boolean;
  expires_in: number;
  ice_servers: RTCIceServer[];
}

export interface UserStats {
  totalSessions: number;
  totalMinutes: number;
  streakDays: number;
  openActionItems: number;
  avgMood: number | null;
}
