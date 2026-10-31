/**
 * Transport-agnostic voice client. The web app uses Bolna's WebRTC SDK; a future
 * React Native app can implement this same interface (e.g. react-native-webrtc + SIP.js,
 * or a WebView bridge) and reuse all the screens' logic unchanged.
 */
export type VoiceState = "idle" | "connecting" | "ringing" | "active" | "ended";

export interface VoiceEvents {
  state: (state: VoiceState) => void;
  start: () => void;
  end: (reason: string) => void;
  error: (err: { code: string; message: string }) => void;
  /** Coach (remote) audio level 0..1 */
  level: (level: number) => void;
}

export interface VoiceClient {
  start(): Promise<void>;
  stop(): Promise<void>;
  setMuted(muted: boolean): void;
  runId(): string | null;
  on<K extends keyof VoiceEvents>(event: K, fn: VoiceEvents[K]): () => void;
}
