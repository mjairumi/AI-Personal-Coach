import type { CSSProperties } from "react";

interface Props {
  coachLevel?: number;
  userLevel?: number;
  state?: "idle" | "connecting" | "active" | "ended" | "error";
  accent?: string;
  size?: number;
}

/** Animated voice orb: breathes when idle, swells with the coach's voice, ripples with yours. */
export function Orb({ coachLevel = 0, userLevel = 0, state = "idle", accent = "#a78bfa", size = 240 }: Props) {
  const speaking = coachLevel > 0.04;
  const scale = 1 + Math.min(coachLevel, 1) * 0.28;
  const ring = 1 + Math.min(userLevel, 1) * 0.45;
  const style = { "--accent": accent, "--size": `${size}px` } as CSSProperties;
  return (
    <div className={`orb-wrap orb-${state}${speaking ? " orb-speaking" : ""}`} style={style} aria-hidden>
      <div className="orb-ring" style={{ transform: `scale(${ring})`, opacity: userLevel > 0.05 ? 0.55 : 0.18 }} />
      <div className="orb-ring orb-ring-2" />
      <div className="orb" style={{ transform: `scale(${scale})` }}>
        <div className="orb-shine" />
      </div>
    </div>
  );
}
