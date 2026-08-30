"use server";

import { redirect } from "next/navigation";
import { BackendError, backendPost } from "@/lib/backend";
import { clearSessionCookie, setSessionCookie } from "@/lib/session";

interface TokenResponse {
  access_token: string;
  expires_at: string;
}

export async function login(formData: FormData): Promise<void> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) redirect("/login?error=missing");

  let token: TokenResponse | undefined;
  let failure: unknown;
  try {
    token = await backendPost<TokenResponse>("/api/v1/auth/login", {
      username,
      password,
    });
  } catch (e) {
    failure = e;
  }
  // redirect() signals by throwing, so it must run outside the catch.
  if (failure || !token) {
    // The backend damps brute force and equalizes timing; it does not say
    // whether the username or the password was wrong, and neither do we.
    const status = failure instanceof BackendError ? failure.status : 0;
    if (status === 429) redirect("/login?error=throttled");
    redirect(status === 503 ? "/login?error=offline" : "/login?error=invalid");
  }

  setSessionCookie(token.access_token, token.expires_at);
  redirect("/");
}

export async function logout(): Promise<void> {
  clearSessionCookie();
  redirect("/login");
}
