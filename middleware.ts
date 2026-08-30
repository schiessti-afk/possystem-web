/**
 * Front door: anonymous requests never reach a dashboard page.
 *
 * This is a cheap presence check on the session cookie — deliberately not the
 * security boundary. Real enforcement is per request in lib/backend.ts, where
 * the backend revalidates the token against the sessions table, so a forged
 * cookie gets past middleware and then renders nothing but a redirect back
 * here.
 */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

export function middleware(request: NextRequest) {
  const signedIn = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isLogin = request.nextUrl.pathname === "/login";

  if (!signedIn && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (signedIn && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except Next's own assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
