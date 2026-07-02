import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

let cached: string | null = null;

/**
 * Instance secret for signing tracking/unsubscribe URLs.
 * Uses AUTH_SECRET when set; otherwise generates one and persists it
 * next to the database so links survive restarts.
 */
export function instanceSecret(): string {
  if (cached) return cached;
  if (process.env.AUTH_SECRET) {
    cached = process.env.AUTH_SECRET;
    return cached;
  }
  const dbPath =
    process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "sendthen.db");
  const file = path.join(path.dirname(dbPath), ".instance-secret");
  try {
    cached = fs.readFileSync(file, "utf8").trim();
    if (cached) return cached;
  } catch {
    // fall through to generate
  }
  cached = randomBytes(32).toString("hex");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, cached, { mode: 0o600 });
  return cached;
}
