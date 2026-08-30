/**
 * Server-side backend client.
 *
 * Every call runs inside React Server Components / server actions, so the
 * session token never reaches client JavaScript. Reads authenticate with the
 * signed-in admin's bearer token, which the backend revalidates against the
 * sessions table on every request; an expired or forged cookie yields 401.
 * Pages opt out of caching (cache: "no-store") because register data must
 * feel live.
 */
import { getSessionToken } from "./session";

const BASE_URL = (process.env.BACKEND_URL ?? "http://127.0.0.1:8000").replace(
  /\/+$/,
  ""
);

export class BackendError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function backendGet<T>(path: string): Promise<T> {
  const token = getSessionToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers,
      cache: "no-store",
    });
  } catch {
    throw new BackendError(`Backend unreachable at ${BASE_URL}`, 503);
  }

  if (!res.ok) {
    throw new BackendError(`Backend returned ${res.status} for ${path}`, res.status);
  }
  return (await res.json()) as T;
}

/** Unauthenticated POST — only the login exchange needs it. */
export async function backendPost<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new BackendError(`Backend unreachable at ${BASE_URL}`, 503);
  }

  if (!res.ok) {
    throw new BackendError(`Backend returned ${res.status} for ${path}`, res.status);
  }
  return (await res.json()) as T;
}
