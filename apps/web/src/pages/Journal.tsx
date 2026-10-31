import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { CoachingSession, UserStats } from "@disha/core";
import { api } from "../lib/api.ts";
import { getUser } from "../lib/user.ts";
import { SessionRow } from "./Home.tsx";

export function Journal() {
  const [sessions, setSessions] = useState<CoachingSession[] | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getUser()) return setSessions([]);
    api.listSessions().then((r) => {
      setSessions(r.sessions);
      setStats(r.stats);
    }).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="journal">
      <h1>Your journal</h1>
      <p className="muted">Every conversation with Disha, with the insights and commitments you made.</p>

      {stats && stats.totalSessions > 0 && (
        <div className="metrics">
          <div className="metric"><span>Sessions</span><b>{stats.totalSessions}</b></div>
          <div className="metric"><span>Minutes talked</span><b>{stats.totalMinutes}</b></div>
          <div className="metric"><span>Day streak</span><b>🔥 {stats.streakDays}</b></div>
          <div className="metric"><span>Next steps</span><b>{stats.openActionItems}</b></div>
          {stats.avgMood != null && <div className="metric"><span>Avg mood</span><b>{stats.avgMood}/10</b></div>}
        </div>
      )}

      {error && <div className="alert">{error}</div>}
      {sessions === null && !error && <p className="muted">Loading…</p>}
      {sessions?.length === 0 && (
        <div className="card center empty">
          <p>No sessions yet. Your first conversation is one tap away.</p>
          <Link to="/" className="btn btn-primary">🎙️ Talk to Disha</Link>
        </div>
      )}
      <div className="session-list">
        {sessions?.map((s) => <SessionRow key={s.id} s={s} />)}
      </div>
    </div>
  );
}
