import fs from "node:fs";
import path from "node:path";
import type { CoachingSession } from "@disha/core";

/**
 * Persistence interface. The MVP uses a JSON file; swap in Postgres/Supabase/Firestore by
 * implementing this interface — nothing else in the server needs to change.
 */
export interface Store {
  get(id: string): Promise<CoachingSession | undefined>;
  upsert(session: CoachingSession): Promise<CoachingSession>;
  listByUser(userId: string): Promise<CoachingSession[]>;
  delete(id: string): Promise<void>;
}

export class JsonFileStore implements Store {
  private sessions = new Map<string, CoachingSession>();
  private writeTimer: NodeJS.Timeout | null = null;

  constructor(private file: string) {
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const s of raw.sessions ?? []) this.sessions.set(s.id, s);
    } catch {
      /* fresh store */
    }
  }

  async get(id: string) {
    return this.sessions.get(id);
  }

  async upsert(session: CoachingSession) {
    this.sessions.set(session.id, session);
    this.scheduleWrite();
    return session;
  }

  async listByUser(userId: string) {
    return [...this.sessions.values()]
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async delete(id: string) {
    this.sessions.delete(id);
    this.scheduleWrite();
  }

  private scheduleWrite() {
    if (this.writeTimer) return;
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      try {
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        const tmp = `${this.file}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify({ sessions: [...this.sessions.values()] }, null, 2));
        fs.renameSync(tmp, this.file);
      } catch (e) {
        console.error("[store] write failed", e);
      }
    }, 200);
  }
}

/** Postgres (e.g. Neon) when DATABASE_URL is set, otherwise the local JSON file. */
export async function createStore(databaseUrl: string, dataFile: string): Promise<Store & { kind: string }> {
  if (databaseUrl) {
    const { PostgresStore } = await import("./pgStore.ts");
    return Object.assign(new PostgresStore(databaseUrl), { kind: "postgres" });
  }
  return Object.assign(new JsonFileStore(dataFile), { kind: "json-file" });
}
