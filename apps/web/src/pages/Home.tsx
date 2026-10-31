import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { COACH_MODES, getMode, type CoachingSession, type UserStats } from "@disha/core";
import { Orb } from "../components/Orb.tsx";
import { api } from "../lib/api.ts";
import { getUser } from "../lib/user.ts";
import { fmtDate, greeting } from "../lib/format.ts";

export function Home() {
  const user = getUser();
  const [recent, setRecent] = useState<CoachingSession[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);

  useEffect(() => {
    if (!user) return;
    api.listSessions().then((r) => {
      setRecent(r.sessions.slice(0, 3));
      setStats(r.stats);
    }).catch(() => {});
  }, []);

  const last = recent.find((s) => s.status === "ready" && s.insights?.followUp);

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{user ? `${greeting()}, ${user.name}` : "Your AI coach & mentor"}</p>
          <h1>
            Talk it through.<br />
            <span className="grad">Find your direction.</span>
          </h1>
          <p className="lead">
            Disha is a voice-first coach for your life and career. Reflect on your actions, untangle tough decisions, and
            leave every conversation with clear next steps — just by talking.
          </p>
          <div className="hero-cta">
            <Link className="btn btn-primary btn-lg" to={`/talk/${last?.modeId ?? "life"}`}>
              🎙️ Start talking
            </Link>
            {stats && stats.totalSessions > 0 && (
              <Link className="btn btn-ghost btn-lg" to="/journal">
                Your journal · {stats.totalSessions}
              </Link>
            )}
          </div>
          {last?.insights?.followUp && (
            <Link className="followup" to={`/talk/${last.modeId}?goal=${encodeURIComponent(last.insights.followUp)}`}>
              <span className="followup-label">Pick up where you left off</span>
              <span>“{last.insights.followUp}”</span>
            </Link>
          )}
        </div>
        <div className="hero-orb">
          <Orb size={260} />
        </div>
      </section>

      <section>
        <h2 className="section-title">Who do you need today?</h2>
        <div className="modes">
          {COACH_MODES.map((m) => (
            <Link key={m.id} to={`/talk/${m.id}`} className="mode-card" style={{ ["--accent" as any]: m.accent }}>
              <span className="mode-emoji">{m.emoji}</span>
              <h3>{m.title}</h3>
              <p>{m.tagline}</p>
              <span className="mode-go">Talk now →</span>
            </Link>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="section-title">Recent sessions</h2>
          <div className="session-list">
            {recent.map((s) => (
              <SessionRow key={s.id} s={s} />
            ))}
          </div>
        </section>
      )}

      <section className="how">
        <h2 className="section-title">How it works</h2>
        <div className="how-grid">
          <div><b>1. Pick a coach</b><p>Life, career, personality, a tough decision, or a quick daily reflection.</p></div>
          <div><b>2. Just talk</b><p>A real back-and-forth voice conversation in your browser. Interrupt anytime.</p></div>
          <div><b>3. Get clarity</b><p>Insights, action steps and a journal entry after every session.</p></div>
          <div><b>4. Disha remembers</b><p>Your coach follows up on your commitments next time.</p></div>
        </div>
      </section>
    </div>
  );
}

export function SessionRow({ s }: { s: CoachingSession }) {
  const mode = getMode(s.modeId);
  return (
    <Link to={`/sessions/${s.id}`} className="session-row" style={{ ["--accent" as any]: mode.accent }}>
      <span className="session-emoji">{mode.emoji}</span>
      <div className="session-main">
        <div className="session-title">{s.insights?.title || s.goal || mode.title}</div>
        <div className="session-sub">
          {mode.title} · {fmtDate(s.createdAt)}
        </div>
        {s.insights?.summary && <div className="session-summary">{s.insights.summary}</div>}
      </div>
      <span className={`pill pill-${s.status}`}>{s.status === "ready" ? (s.insights?.mood ?? "done") : s.status}</span>
    </Link>
  );
}
