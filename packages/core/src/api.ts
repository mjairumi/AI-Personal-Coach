import type { BolnaWebSession, CoachingSession, StartSessionRequest, UserStats } from "./types.ts";

/**
 * Platform-agnostic API client (uses global fetch) — works in the browser, React Native and Node.
 * `baseUrl` is "" on the web (same origin) and the deployed server URL on mobile.
 */
export function createApiClient(baseUrl = "", getUserId?: () => string | null) {
  async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const uid = getUserId?.();
    if (uid) headers["X-User-Id"] = uid;
    const res = await fetch(`${baseUrl}${path}`, { ...init, headers: { ...headers, ...(init.headers as any) } });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const err = new Error(body?.error ?? body?.message ?? `Request failed (${res.status})`) as Error & {
        status?: number;
        body?: unknown;
      };
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body as T;
  }

  return {
    health: () => req<{ ok: boolean; bolnaConfigured: boolean; insightsProvider: string }>("/api/health"),
    /** Mint a single-use Bolna web-call session (server keeps the API key). */
    mintSession: (body: StartSessionRequest) =>
      req<BolnaWebSession>("/api/bolna-session", { method: "POST", body: JSON.stringify(body) }),
    endSession: (id: string, durationSec: number) =>
      req<CoachingSession>(`/api/sessions/${encodeURIComponent(id)}/end`, {
        method: "POST",
        body: JSON.stringify({ durationSec }),
      }),
    getSession: (id: string) => req<CoachingSession>(`/api/sessions/${encodeURIComponent(id)}`),
    listSessions: () => req<{ sessions: CoachingSession[]; stats: UserStats }>("/api/sessions"),
    deleteSession: (id: string) => req<{ ok: true }>(`/api/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
