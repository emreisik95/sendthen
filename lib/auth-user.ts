import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { count, eq, isNull, lt } from "drizzle-orm";
import {
  db,
  apiKeys,
  domains,
  emails,
  sessions,
  users,
  webhooks,
  type User,
} from "./db";
import { newSessionToken, newUserId } from "./id";

const COOKIE = "st_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/* ---------- passwords (scrypt, no deps) ---------- */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length &&
    timingSafeEqual(candidate, expected)
  );
}

/* ---------- sessions ---------- */

const hashSession = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function createUserSession(userId: string): Promise<void> {
  const token = newSessionToken();
  const now = Date.now();
  await db.insert(sessions).values({
    id: hashSession(token),
    userId,
    expiresAt: new Date(now + SESSION_TTL_MS),
    createdAt: new Date(now),
  });
  // opportunistic cleanup of expired sessions
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date(now)));
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  });
}

export async function destroyUserSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, hashSession(token)));
  }
  store.delete(COOKIE);
}

export async function getSessionUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, hashSession(token)));
  if (!row) return null;
  if (row.session.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, row.session.id));
    return null;
  }
  return row.user;
}

/** For server components / actions: redirect to /login when signed out. */
export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/* ---------- registration ---------- */

export function signupDisabled(): boolean {
  return process.env.DISABLE_SIGNUP === "true";
}

export async function userCount(): Promise<number> {
  const [{ value }] = await db.select({ value: count() }).from(users);
  return value;
}

/**
 * Create a user. The first user becomes admin and adopts any legacy
 * rows created before multi-user support (user_id IS NULL).
 */
export async function registerUser(
  email: string,
  name: string,
  password: string,
): Promise<User> {
  const isFirst = (await userCount()) === 0;
  const [user] = await db
    .insert(users)
    .values({
      id: newUserId(),
      email: email.toLowerCase().trim(),
      name: name.trim(),
      passwordHash: hashPassword(password),
      role: isFirst ? "admin" : "member",
      createdAt: new Date(),
    })
    .returning();

  if (isFirst) {
    await db
      .update(apiKeys)
      .set({ userId: user.id })
      .where(isNull(apiKeys.userId));
    await db
      .update(domains)
      .set({ userId: user.id })
      .where(isNull(domains.userId));
    await db
      .update(emails)
      .set({ userId: user.id })
      .where(isNull(emails.userId));
    await db
      .update(webhooks)
      .set({ userId: user.id })
      .where(isNull(webhooks.userId));
  }

  return user;
}
