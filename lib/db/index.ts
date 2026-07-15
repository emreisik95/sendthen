import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";
import {
  databasePathForPhase,
  NEXT_PRODUCTION_BUILD_PHASE,
} from "../db-path";

const DB_PATH = databasePathForPhase(
  process.env.NEXT_PHASE,
  process.env.DATABASE_PATH,
  process.cwd(),
);

declare global {
  var __sendthenDb: ReturnType<typeof createDb> | undefined;
}

function syncSleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Next.js build/dev can spawn several workers that open the DB at once;
 * a directory lock serializes migrations across processes.
 */
function migrateLocked(db: ReturnType<typeof drizzle>): void {
  const lockDir = `${DB_PATH}.migrate-lock`;
  const deadline = Date.now() + 15_000;
  for (;;) {
    try {
      fs.mkdirSync(lockDir);
      break;
    } catch {
      if (Date.now() > deadline) {
        fs.rmSync(lockDir, { recursive: true, force: true });
        continue;
      }
      syncSleep(100);
    }
  }
  try {
    migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  } finally {
    fs.rmSync(lockDir, { recursive: true, force: true });
  }
}

function createDb() {
  if (DB_PATH !== ":memory:") {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  }
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  // Build workers use independent in-memory databases and skip migrations.
  // Runtime processes keep the configured persistent database and migrate it.
  if (process.env.NEXT_PHASE !== NEXT_PRODUCTION_BUILD_PHASE) {
    migrateLocked(db);
  }
  return db;
}

// singleton across Next.js hot reloads
export const db = globalThis.__sendthenDb ?? createDb();
globalThis.__sendthenDb = db;

export * from "./schema";
