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

export function getSummary(): Promise<SummaryResponse | null> {
  return safe(backendGet<SummaryResponse>("/api/v1/dashboard/summary"));
}

export function getActivity(limit = 25): Promise<ActivityItem[] | null> {
  return safe(backendGet<ActivityItem[]>(`/api/v1/dashboard/activity?limit=${limit}`));
}

export function getShifts(limit = 50): Promise<ShiftRow[] | null> {
  return safe(backendGet<ShiftRow[]>(`/api/v1/dashboard/shifts?limit=${limit}`));
}
