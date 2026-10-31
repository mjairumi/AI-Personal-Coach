import pg from "pg";
import type { CoachingSession } from "@disha/core";
import type { Store } from "./store.ts";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS coaching_sessions (
  id            TEXT PRIMARY KEY,               -- Bolna run_id / execution id
  user_id       TEXT NOT NULL,
  user_name     TEXT NOT NULL DEFAULT '',
  mode_id       TEXT NOT NULL,
  goal          TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL,                  -- live | processing | ready | failed
  bolna_status  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at      TIMESTAMPTZ,
  duration_sec  INTEGER,
  transcript    JSONB NOT NULL DEFAULT '[]'::jsonb,
  insights      JSONB,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coaching_sessions_user_created_idx ON coaching_sessions (user_id, created_at DESC);
`;

type Row = {
  id: string;
  user_id: string;
  user_name: string;
  mode_id: string;
  goal: string;
  status: string;
  bolna_status: string | null;
  created_at: Date;
  ended_at: Date | null;
  duration_sec: number | null;
  transcript: CoachingSession["transcript"];
  insights: CoachingSession["insights"] | null;
};

function fromRow(r: Row): CoachingSession {
  return {
    id: r.id,
    userId: r.user_id,
    userName: r.user_name,
    modeId: r.mode_id as CoachingSession["modeId"],
    goal: r.goal,
    status: r.status as CoachingSession["status"],
    bolnaStatus: r.bolna_status ?? undefined,
    createdAt: r.created_at.toISOString(),
    endedAt: r.ended_at?.toISOString(),
    durationSec: r.duration_sec ?? undefined,
    transcript: r.transcript ?? [],
    insights: r.insights ?? undefined,
  };
}

/** PostgreSQL store (works with Neon, Supabase, RDS, local Postgres). Creates its table on startup. */
export class PostgresStore implements Store {
  private pool: pg.Pool;
  private ready: Promise<void>;

  constructor(connectionString: string) {
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
    this.pool = new pg.Pool({
      connectionString,
      // Neon requires TLS; its URLs carry ?sslmode=require. Default to TLS for any non-local host.
      ssl: local || /sslmode=disable/.test(connectionString) ? undefined : { rejectUnauthorized: true },
      max: Number(process.env.PG_POOL_MAX ?? 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000, // Neon may need a few seconds to wake a suspended compute
    });
    // Neon closes idle connections; don't let that crash the process.
    this.pool.on("error", (err) => console.warn("[pg] idle client error:", err.message));
    this.ready = this.pool.query(SCHEMA).then(() => console.log("[pg] connected, schema ready"));
    this.ready.catch((e) => console.error("[pg] schema init failed:", e.message));
  }

  async get(id: string) {
    await this.ready;
    const { rows } = await this.pool.query<Row>("SELECT * FROM coaching_sessions WHERE id = $1", [id]);
    return rows[0] ? fromRow(rows[0]) : undefined;
  }

  async upsert(s: CoachingSession) {
    await this.ready;
    await this.pool.query(
      `INSERT INTO coaching_sessions
         (id, user_id, user_name, mode_id, goal, status, bolna_status, created_at, ended_at, duration_sec, transcript, insights, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET
         user_name = EXCLUDED.user_name, mode_id = EXCLUDED.mode_id, goal = EXCLUDED.goal,
         status = EXCLUDED.status, bolna_status = EXCLUDED.bolna_status, ended_at = EXCLUDED.ended_at,
         duration_sec = EXCLUDED.duration_sec, transcript = EXCLUDED.transcript,
         insights = EXCLUDED.insights, updated_at = now()`,
      [
        s.id,
        s.userId,
        s.userName,
        s.modeId,
        s.goal,
        s.status,
        s.bolnaStatus ?? null,
        s.createdAt,
        s.endedAt ?? null,
        s.durationSec ?? null,
        JSON.stringify(s.transcript ?? []),
        s.insights ? JSON.stringify(s.insights) : null,
      ],
    );
    return s;
  }

  async listByUser(userId: string) {
    await this.ready;
    const { rows } = await this.pool.query<Row>(
      "SELECT * FROM coaching_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200",
      [userId],
    );
    return rows.map(fromRow);
  }

  async delete(id: string) {
    await this.ready;
    await this.pool.query("DELETE FROM coaching_sessions WHERE id = $1", [id]);
  }

  async ping() {
    await this.ready;
    await this.pool.query("SELECT 1");
  }
}
