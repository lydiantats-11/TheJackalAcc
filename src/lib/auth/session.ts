import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { sql, isDatabaseConfigured } from "@/lib/db";
import { env } from "@/lib/env";
import { createSession, destroySession, userForSessionToken, type SessionUser } from "./service";

export const SESSION_COOKIE = "fr_session";

export const currentUser = cache(async (): Promise<SessionUser | null> => {
  if (!isDatabaseConfigured()) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return userForSessionToken(sql(), token);
});

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/?denied=1");
  return u;
}

export async function startSession(userId: string): Promise<void> {
  const { token, expiresAt } = await createSession(sql(), userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env().COOKIE_SECURE === "true",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  await destroySession(sql(), jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
}

/**
 * Client IP for rate limiting. Forwarding headers are client-controlled unless a trusted proxy overwrites them,
 * so they are only used when TRUST_PROXY=true (set this ONLY behind a proxy such as Vercel/Fly that sets them).
 * Without it, IP-based limiting is off and the per-email limit still applies.
 */
export async function clientIp(): Promise<string | null> {
  if (process.env.TRUST_PROXY !== "true") return null;
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? null;
}
