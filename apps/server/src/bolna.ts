import { config } from "./config.ts";

export class BolnaError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`Bolna API error ${status}`);
  }
}

async function bolnaFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${config.bolnaApiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.bolnaApiKey}`,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string>),
    },
  });
  const text = await res.text();
  let body: any = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) throw new BolnaError(res.status, body);
  return body;
}

/**
 * Mint a single-use, short-lived (~120s) WebRTC call session for the browser.
 * `user_data` fills the {variables} in the agent's prompt and welcome message.
 */
export function mintWebCallSession(userData: Record<string, string>) {
  return bolnaFetch("/web-call/freeswitch-session", {
    method: "POST",
    body: JSON.stringify({ agent_id: config.bolnaAgentId, user_data: userData }),
  });
}

/** Fetch a call execution (status, transcript, summary, extracted data). */
export function getExecution(executionId: string) {
  return bolnaFetch(`/executions/${encodeURIComponent(executionId)}`);
}

/** Execution statuses after which no more data will arrive. */
export const TERMINAL_STATUSES = new Set([
  "completed",
  "call-disconnected",
  "failed",
  "error",
  "canceled",
  "cancelled",
  "no-answer",
  "busy",
  "stopped",
  "balance-low",
]);
