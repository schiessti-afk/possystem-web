import { backendGet } from "./backend";
import type { ActivityItem, ShiftRow, SummaryResponse } from "./types";

/** Resolve to null on any failure so pages can render a friendly card. */
async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

export function getSummary(
  opts: { from?: string; to?: string } = {},
): Promise<SummaryResponse | null> {
  const params = new URLSearchParams();
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  const qs = params.toString();
  return safe(
    backendGet<SummaryResponse>(
      `/api/v1/dashboard/summary${qs ? `?${qs}` : ""}`,
    ),
  );
}

export function getActivity(opts: {
  limit?: number;
  from?: string;
  to?: string;
} = {}): Promise<ActivityItem[] | null> {
  const params = new URLSearchParams();
  params.set("limit", String(opts.limit ?? 25));
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  return safe(backendGet<ActivityItem[]>(`/api/v1/dashboard/activity?${params}`));
}

export function getShifts(limit = 50): Promise<ShiftRow[] | null> {
  return safe(backendGet<ShiftRow[]>(`/api/v1/dashboard/shifts?limit=${limit}`));
}
