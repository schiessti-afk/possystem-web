/**
 * Deterministic formatters — safe for SSR hydration.
 * Fixed locale/timezone so server and client render identical strings.
 * Adjust CURRENCY if the shop settles in another currency.
 */
const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function fmtMoney(v: number | null | undefined): string {
  return v == null ? "—" : CURRENCY.format(v);
}

export function fmtInt(v: number | null | undefined): string {
  return v == null ? "—" : new Intl.NumberFormat("en-US").format(v);
}

/** "2025-01-15 14:03:22 UTC" — deterministic across server/client. */
export function fmtUtc(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const s = d.toISOString();
  return `${s.slice(0, 10)} ${s.slice(11, 19)} UTC`;
}

/** Same instant as fmtUtc, split so the table can stack date over time. */
export function fmtUtcParts(iso: string | null | undefined): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso, time: "" };
  const s = d.toISOString();
  return { date: s.slice(0, 10), time: `${s.slice(11, 19)} UTC` };
}
