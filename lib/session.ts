/**
 * Dashboard session cookie.
 *
 * Holds the opaque bearer token issued by POST /api/v1/auth/login. It is
 * httpOnly so no client script can read it, and every backend call revalidates
 * it against the sessions table — the cookie's presence alone grants nothing.
 */
import { cookies } from "next/headers";

export const SESSION_COOKIE = "pos_session";

export function getSessionToken(): string | undefined {
  return cookies().get(SESSION_COOKIE)?.value;
}

export function setSessionCookie(token: string, expiresAt: string): void {
  const expires = new Date(expiresAt);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Plain http is only ever used for local `npm run dev`.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: Number.isNaN(expires.getTime()) ? undefined : expires,
  });
}

export function clearSessionCookie(): void {
  cookies().delete(SESSION_COOKIE);
}
