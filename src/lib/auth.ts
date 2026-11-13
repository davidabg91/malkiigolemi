import "server-only";
import { eq } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { db } from "@/db";
import { users } from "@/db/schema";

const COOKIE = "limona_session";
const MAX_AGE = 60 * 60 * 24 * 30;

export type Session = { uid: number; role: "customer" | "admin"; name: string; email: string };

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET is missing or too short. Set it in .env.local (32+ characters).");
  }
  return new TextEncoder().encode(value);
}

export async function createSession(session: Session) {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/**
 * The cookie only proves who signed in; the account itself is read from the database so a deleted
 * or demoted user stops counting as signed in (a stale cookie otherwise loops between /vhod and /profil).
 * Cached per request because the header, page and actions all ask.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  // Checking the token's expiry reads the clock, so it must wait for the real request (never a prerender).
  await connection();
  let uid: number;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (typeof payload.uid !== "number") return null;
    uid = payload.uid;
  } catch {
    return null;
  }
  const [user] = await db
    .select({ id: users.id, role: users.role, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, uid))
    .limit(1);
  return user ? { uid: user.id, role: user.role, name: user.name, email: user.email } : null;
});

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

/** For admin pages: bounces anyone who is not a signed-in admin. */
export async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/vhod?next=/admin");
  if (session.role !== "admin") redirect("/");
  return session;
}

/** For admin server actions: throws instead of redirecting so a forged call simply fails. */
export async function assertAdmin() {
  const session = await getSession();
  if (session?.role !== "admin") throw new Error("Нямате права за това действие.");
  return session;
}

/** Only allow same-site relative redirects after login. */
export function safeNext(next: unknown, fallback = "/profil") {
  return typeof next === "string" && /^\/(?!\/|\\)/.test(next) ? next : fallback;
}

const attempts = new Map<string, { n: number; until: number }>();

/** Small in-memory brake on password guessing; swap for a shared store when running multiple instances. */
export function tooManyAttempts(key: string, limit = 8, windowMs = 10 * 60_000) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.until < now) {
    attempts.set(key, { n: 1, until: now + windowMs });
    return false;
  }
  entry.n += 1;
  return entry.n > limit;
}
