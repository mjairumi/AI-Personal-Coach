import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getMode } from "@disha/core";
import { Orb } from "../components/Orb.tsx";
import { useCoachCall } from "../lib/useCoachCall.ts";
import { getUser, saveUserName } from "../lib/user.ts";
import { api } from "../lib/api.ts";
import { fmtClock } from "../lib/format.ts";

export function Talk() {
  const { modeId } = useParams();
  const [params] = useSearchParams();
  const mode = getMode(modeId);
  const navigate = useNavigate();
  const call = useCoachCall();

  const [name, setName] = useState(getUser()?.name ?? "");
  const [goal, setGoal] = useState(params.get("goal") ?? "");
  const needsName = !getUser();

  const begin = async () => {
    if (!name.trim()) return;
    const user = saveUserName(name);
    await call.start({ userId: user.id, userName: user.name, modeId: mode.id, goal: goal.trim() || undefined });
  };

  // When the call ends, mark it ended on the server and go to the reflection page.
  useEffect(() => {
    if (call.phase !== "ended") return;
    const id = call.runId;
    if (!id) return;
    api.endSession(id, call.durationSec).catch(() => {}).finally(() => navigate(`/sessions/${id}`));
  }, [call.phase]);

  const status = useMemo(() => {
    if (call.phase === "connecting") return call.voiceState === "ringing" ? "Disha is joining…" : "Connecting…";
    if (call.phase === "active") {
      if (call.muted) return "You're muted";
      if (call.coachLevel > 0.04) return "Disha is speaking";
      if (call.userLevel > 0.08) return "Listening…";
      return "Your turn — speak whenever you're ready";
    }
    if (call.phase === "ended") return "Wrapping up your session…";
    return "";
  }, [call.phase, call.voiceState, call.coachLevel, call.userLevel, call.muted]);

  const inCall = call.phase === "connecting" || call.phase === "active" || call.phase === "ended";

  return (
    <div className="talk" style={{ ["--accent" as any]: mode.accent }}>
      {!inCall && (
        <div className="talk-setup card">
          <Link to="/" className="back">← All coaches</Link>
          <div className="talk-mode">
            <span className="mode-emoji big">{mode.emoji}</span>
            <div>
              <h1>{mode.title}</h1>
              <p className="muted">{mode.tagline}</p>
            </div>
          </div>

          {needsName && (
            <label className="field">
              <span>What should Disha call you?</span>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" maxLength={40} />
            </label>
          )}

          <label className="field">
            <span>What's on your mind? <em className="muted">(optional)</em></span>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. I got a job offer at a startup but I'm scared to leave my stable job…"
              rows={3}
              maxLength={300}
            />
          </label>
          <div className="chips">
            {mode.starters.map((s) => (
              <button key={s} className={`chip${goal === s ? " chip-on" : ""}`} onClick={() => setGoal(s)} type="button">
                {s}
              </button>
            ))}
          </div>

          {call.error && <div className="alert">{call.error}</div>}

          <button className="btn btn-primary btn-lg btn-block" disabled={!name.trim()} onClick={begin}>
            🎙️ {call.phase === "error" ? "Try again" : "Start voice session"}
          </button>
          <p className="hint">🎧 Headphones give the best experience. You'll be asked for microphone access.</p>
        </div>
      )}

      {inCall && (
        <div className="call">
          <div className="call-top">
            <span className="call-mode">{mode.emoji} {mode.title}</span>
            {call.phase === "active" && <span className="call-timer"><span className="rec-dot" />{fmtClock(call.elapsed)}</span>}
          </div>
          <Orb coachLevel={call.coachLevel} userLevel={call.userLevel} state={call.phase} accent={mode.accent} size={280} />
          <p className="call-status" aria-live="polite">{status}</p>
          {call.phase === "active" && <p className="call-tip">Speak naturally — you can interrupt Disha anytime. Say “let's wrap up” when you're done.</p>}
          {call.error && call.phase === "active" && <div className="alert">{call.error}</div>}
          <div className="call-controls">
            <button className={`ctrl${call.muted ? " ctrl-on" : ""}`} onClick={call.toggleMute} disabled={call.phase !== "active"} aria-label={call.muted ? "Unmute" : "Mute"}>
              {call.muted ? "🔇" : "🎤"}
              <span>{call.muted ? "Unmute" : "Mute"}</span>
            </button>
            <button className="ctrl ctrl-end" onClick={call.stop} disabled={call.phase === "ended"} aria-label="End session">
              ✕<span>End</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
