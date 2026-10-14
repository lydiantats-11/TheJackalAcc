/**
 * Framework-independent auth service (testable without Next.js).
 * Session tokens: 32 random bytes; only their SHA-256 is stored, so a database leak cannot be replayed as a login.
 */
import { createHash, randomBytes } from "node:crypto";
import type postgres from "postgres";
import { z } from "zod";
import { DUMMY_HASH, hashPassword, verifyPassword } from "./password";

export type Role = "user" | "adviser" | "admin";
export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  locale: "el" | "en";
}

export class AuthError extends Error {
  constructor(readonly code: "invalid_credentials" | "rate_limited" | "email_taken" | "invalid_input" | "forbidden" | "unauthenticated") {
    super(code);
  }
}

export const SESSION_TTL_MS = 14 * 24 * 3600 * 1000;
const LOGIN_WINDOW_MIN = 15;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 20;

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10, "password_too_short").max(200),
});

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function registerUser(sql: postgres.Sql, input: { email: string; password: string; locale?: "el" | "en" }): Promise<SessionUser> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) throw new AuthError("invalid_input");
  const hash = await hashPassword(parsed.data.password);
  try {
    const [u] = await sql<SessionUser[]>`
      INSERT INTO users (email, password_hash, locale) VALUES (${parsed.data.email}, ${hash}, ${input.locale ?? "el"})
      RETURNING id, email, role, locale`;
    await sql`INSERT INTO user_profiles (user_id) VALUES (${u!.id})`;
    await sql`INSERT INTO notification_preferences (user_id) VALUES (${u!.id})`;
    return u!;
  } catch (err) {
    if ((err as { code?: string }).code === "23505") throw new AuthError("email_taken");
    throw err;
  }
}

async function recentFailures(sql: postgres.Sql, key: string): Promise<number> {
  const [r] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM login_attempts
    WHERE key = ${key} AND NOT succeeded AND attempted_at > now() - make_interval(mins => ${LOGIN_WINDOW_MIN})`;
  return r?.n ?? 0;
}

export async function verifyLogin(sql: postgres.Sql, input: { email: string; password: string }, ip: string | null): Promise<SessionUser> {
  const email = String(input.email ?? "").trim().toLowerCase();
  const emailKey = "e:" + sha256(email);
  const ipKey = ip ? "i:" + sha256(ip) : null;
  if ((await recentFailures(sql, emailKey)) >= MAX_FAILURES_PER_EMAIL) throw new AuthError("rate_limited");
  if (ipKey && (await recentFailures(sql, ipKey)) >= MAX_FAILURES_PER_IP) throw new AuthError("rate_limited");

  const [u] = await sql<(SessionUser & { password_hash: string })[]>`
    SELECT id, email, role, locale, password_hash FROM users WHERE lower(email) = ${email} AND deleted_at IS NULL`;
  const ok = await verifyPassword(String(input.password ?? ""), u?.password_hash ?? DUMMY_HASH);
  const succeeded = Boolean(u && ok);
  await sql`INSERT INTO login_attempts (key, succeeded) VALUES (${emailKey}, ${succeeded})`;
  if (ipKey) await sql`INSERT INTO login_attempts (key, succeeded) VALUES (${ipKey}, ${succeeded})`;
  if (!succeeded || !u) throw new AuthError("invalid_credentials");
  return { id: u.id, email: u.email, role: u.role, locale: u.locale };
}

export async function createSession(sql: postgres.Sql, userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await sql`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (${sha256(token)}, ${userId}, ${expiresAt})`;
  return { token, expiresAt };
}

export async function userForSessionToken(sql: postgres.Sql, token: string | undefined): Promise<SessionUser | null> {
  if (!token || token.length > 100) return null;
  const [u] = await sql<SessionUser[]>`
    SELECT u.id, u.email, u.role, u.locale FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${sha256(token)} AND s.expires_at > now() AND u.deleted_at IS NULL`;
  return u ?? null;
}

export async function destroySession(sql: postgres.Sql, token: string | undefined): Promise<void> {
  if (token) await sql`DELETE FROM sessions WHERE token_hash = ${sha256(token)}`;
}

export function assertAdmin(user: SessionUser | null): asserts user is SessionUser {
  if (!user) throw new AuthError("unauthenticated");
  if (user.role !== "admin") throw new AuthError("forbidden");
}
