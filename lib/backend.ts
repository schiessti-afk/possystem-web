/**
 * Server-side backend client.
 *
 * Every call runs inside React Server Components / route handlers, so
 * DASHBOARD_API_KEY never reaches the browser. Pages opt out of caching
 * (cache: "no-store") because register data must feel live.
 */

const BASE_URL = (process.env.BACKEND_URL ?? "http://127.0.0.1:8000").replace(
  /\/+$/,
  ""
);
const API_KEY = process.env.DASHBOARD_API_KEY ?? "";

export class BackendError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function backendGet<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (API_KEY) headers["X-API-Key"] = API_KEY;

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
