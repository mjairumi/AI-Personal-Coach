import { BolnaWebCall, type CallError } from "@bolna/web-call";
import type { BolnaWebSession, StartSessionRequest } from "@disha/core";
import { api } from "../lib/api.ts";
import type { VoiceClient, VoiceEvents } from "./VoiceClient.ts";

const FRIENDLY: Record<string, string> = {
  microphone_denied: "Microphone access was blocked. Allow the mic in your browser's address bar and try again.",
  at_capacity: "All coaching lines are busy right now. Please try again in a minute.",
  connect_failed: "Couldn't connect the voice line. Check your connection and try again.",
  call_rejected: "The voice session was declined. Please try again.",
  autoplay_blocked: "Your browser blocked audio playback. Tap start again.",
  already_active: "A session is already running.",
};

/** VoiceClient backed by Bolna's browser SDK (@bolna/web-call, WebRTC/Opus). */
export function createBolnaVoice(req: StartSessionRequest): VoiceClient {
  const call = new BolnaWebCall({
    // Our backend mints the ephemeral session and injects persona + memory as user_data.
    getSession: async () => {
      try {
        return (await api.mintSession(req)) as BolnaWebSession as any;
      } catch (e: any) {
        const err = new Error(e?.message ?? "Could not start a session") as Error & { code?: string };
        if (e?.status === 429) err.code = "at_capacity";
        throw err;
      }
    },
    debug: import.meta.env.DEV,
  });

  const listeners: { [K in keyof VoiceEvents]?: Set<VoiceEvents[K]> } = {};
  const emit = <K extends keyof VoiceEvents>(ev: K, ...args: Parameters<VoiceEvents[K]>) =>
    listeners[ev]?.forEach((fn) => (fn as any)(...args));

  call.on("state-change", (s) => emit("state", s));
  call.on("call-start", () => emit("start"));
  call.on("call-end", ({ reason }) => emit("end", reason));
  call.on("volume-level", (l) => emit("level", l));
  call.on("error", (e: CallError) => {
    const anyCause = e.cause as any;
    const code = anyCause?.code === "at_capacity" ? "at_capacity" : e.code;
    const message = FRIENDLY[code] ?? (e.code === "mint_failed" ? e.message : "Something went wrong with the voice line.");
    emit("error", { code, message });
  });

  return {
    start: () => call.start(),
    stop: () => call.stop(),
    setMuted: (m) => call.setMuted(m),
    runId: () => call.getRunId(),
    on(event, fn) {
      (listeners[event] ??= new Set() as any).add(fn);
      return () => listeners[event]?.delete(fn as any);
    },
  };
}
