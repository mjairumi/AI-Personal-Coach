import { useCallback, useEffect, useRef, useState } from "react";
import type { StartSessionRequest } from "@disha/core";
import { createBolnaVoice } from "../voice/bolnaVoice.ts";
import type { VoiceClient, VoiceState } from "../voice/VoiceClient.ts";

export type Phase = "idle" | "connecting" | "active" | "ended" | "error";

/** Local mic level meter (independent of the SDK) so the orb can react to the user too. */
async function startMicMeter(onLevel: (l: number) => void): Promise<() => void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      onLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
    };
  } catch {
    return () => {};
  }
}

export function useCoachCall() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [coachLevel, setCoachLevel] = useState(0);
  const [userLevel, setUserLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [runId, setRunId] = useState<string | null>(null);
  const [endReason, setEndReason] = useState<string | null>(null);

  const clientRef = useRef<VoiceClient | null>(null);
  const startedAt = useRef<number | null>(null);
  const stopMeter = useRef<() => void>(() => {});
  const mutedRef = useRef(false);

  useEffect(() => {
    if (phase !== "active") return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - (startedAt.current ?? Date.now())) / 1000)), 500);
    return () => clearInterval(t);
  }, [phase]);

  // Hang up if the component unmounts mid-call.
  useEffect(() => () => {
    clientRef.current?.stop().catch(() => {});
    stopMeter.current();
  }, []);

  const start = useCallback(async (req: StartSessionRequest) => {
    if (clientRef.current) return;
    setError(null);
    setEndReason(null);
    setElapsed(0);
    setPhase("connecting");
    const client = createBolnaVoice(req);
    clientRef.current = client;

    client.on("state", setVoiceState);
    client.on("level", setCoachLevel);
    client.on("start", async () => {
      startedAt.current = Date.now();
      setRunId(client.runId());
      setPhase("active");
      stopMeter.current = await startMicMeter((l) => setUserLevel(mutedRef.current ? 0 : l));
    });
    client.on("end", (reason) => {
      stopMeter.current();
      setCoachLevel(0);
      setUserLevel(0);
      setRunId((r) => r ?? client.runId());
      setEndReason(reason);
      setPhase((p) => (p === "error" ? p : reason === "failed" && !startedAt.current ? "error" : "ended"));
      clientRef.current = null;
    });
    client.on("error", (e) => {
      setError(e.message);
      if (!startedAt.current) setPhase("error");
    });

    try {
      await client.start();
    } catch (e: any) {
      // Errors are surfaced through the "error" event; make sure we don't stay stuck.
      setError((prev) => prev ?? e?.message ?? "Could not start the session.");
      setPhase((p) => (p === "connecting" ? "error" : p));
      clientRef.current = null;
    }
  }, []);

  const stop = useCallback(async () => {
    await clientRef.current?.stop();
  }, []);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    clientRef.current?.setMuted(next);
    setMuted(next);
  }, []);

  const reset = useCallback(() => {
    startedAt.current = null;
    setPhase("idle");
    setError(null);
    setRunId(null);
  }, []);

  const durationSec = startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : 0;

  return { phase, voiceState, error, muted, coachLevel, userLevel, elapsed, runId, endReason, durationSec, start, stop, toggleMute, reset };
}
