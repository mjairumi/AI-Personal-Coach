import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getMode, type CoachingSession } from "@disha/core";
import { Orb } from "../components/Orb.tsx";
import { api } from "../lib/api.ts";
import { fmtDate, fmtDuration } from "../lib/format.ts";

const doneKey = (id: string) => `disha.done.${id}`;

export function SessionDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<CoachingSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [done, setDone] = useState<number[]>(() => JSON.parse(localStorage.getItem(doneKey(id)) ?? "[]"));

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    const poll = async () => {
      try {
        const s = await api.getSession(id);
        if (stop) return;
        setSession(s);
        if (s.status !== "ready" && s.status !== "failed" && Date.now() - started < 5 * 60_000) timer = setTimeout(poll, 3000);
      } catch (e: any) {
        if (!stop) setError(e?.message ?? "Could not load session");
      }
    };
    poll();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [id]);

  const toggleDone = (i: number) => {
    const next = done.includes(i) ? done.filter((x) => x !== i) : [...done, i];
    setDone(next);
    localStorage.setItem(doneKey(id), JSON.stringify(next));
  };

  if (error) return <div className="card center"><p>{error}</p><Link to="/" className="btn btn-ghost">Back home</Link></div>;
  if (!session) return <div className="center"><Orb size={140} state="connecting" /></div>;

  const mode = getMode(session.modeId);
  const i = session.insights;

  if (session.status !== "ready") {
    return (
      <div className="processing center" style={{ ["--accent" as any]: mode.accent }}>
        <Orb size={180} state="connecting" accent={mode.accent} />
        <h2>Disha is reflecting on your conversation…</h2>
        <p className="muted">Pulling together your insights and next steps. This usually takes 10–30 seconds.</p>
      </div>
    );
  }

  return (
    <div className="detail" style={{ ["--accent" as any]: mode.accent }}>
      <Link to="/journal" className="back">← Journal</Link>
      <div className="detail-head">
        <span className="mode-emoji big">{mode.emoji}</span>
        <div>
          <h1>{i?.title || session.goal || mode.title}</h1>
          <p className="muted">
            {mode.title} · {fmtDate(session.createdAt)} · {fmtDuration(session.durationSec)}
          </p>
        </div>
      </div>

      {i?.summary ? (
        <div className="card summary">
          <h3>Session reflection</h3>
          <p>{i.summary}</p>
        </div>
      ) : (
        <div className="card summary">
          <h3>Session reflection</h3>
          <p className="muted">
            {session.transcript.length ? "No summary was generated for this session — your full conversation is below." : "This session ended before a conversation was captured."}
          </p>
        </div>
      )}

      <div className="grid-2">
        {i && i.keyInsights.length > 0 && (
          <div className="card">
            <h3>💡 Key insights</h3>
            <ul className="insights">{i.keyInsights.map((k, n) => <li key={n}>{k}</li>)}</ul>
          </div>
        )}
        {i && i.actionItems.length > 0 && (
          <div className="card">
            <h3>✅ Your next steps</h3>
            <ul className="actions">
              {i.actionItems.map((a, n) => (
                <li key={n} className={done.includes(n) ? "done" : ""}>
                  <label>
                    <input type="checkbox" checked={done.includes(n)} onChange={() => toggleDone(n)} />
                    <span>{a}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {(i?.mood || i?.moodScore || i?.confidenceScore) && (
        <div className="metrics">
          {i?.mood && <div className="metric"><span>Mood</span><b>{i.mood}</b></div>}
          {i?.moodScore && <div className="metric"><span>Mood score</span><b>{i.moodScore}/10</b></div>}
          {i?.confidenceScore && <div className="metric"><span>Confidence</span><b>{i.confidenceScore}/10</b></div>}
        </div>
      )}

      <div className="detail-cta">
        <Link className="btn btn-primary" to={`/talk/${session.modeId}${i?.followUp ? `?goal=${encodeURIComponent(i.followUp)}` : ""}`}>
          🎙️ Continue with Disha
        </Link>
        {session.transcript.length > 0 && (
          <button className="btn btn-ghost" onClick={() => setShowTranscript((v) => !v)}>
            {showTranscript ? "Hide" : "Show"} transcript
          </button>
        )}
        <button
          className="btn btn-ghost btn-danger"
          onClick={async () => {
            if (!confirm("Delete this session from your journal?")) return;
            await api.deleteSession(session.id);
            navigate("/journal");
          }}
        >
          Delete
        </button>
      </div>

      {showTranscript && (
        <div className="card transcript">
          {session.transcript.map((t, n) => (
            <div key={n} className={`bubble bubble-${t.role}`}>
              <span className="bubble-who">{t.role === "coach" ? "Disha" : session.userName}</span>
              <p>{t.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
