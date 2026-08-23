import EventBadge from "./EventBadge";
import { fmtMoney, fmtUtc } from "@/lib/format";
import type { ActivityItem } from "@/lib/types";

function amountOf(e: ActivityItem): string | null {
  const d = e.data ?? {};
  for (const key of ["gross_amount", "refund_amount", "amount", "opening_float", "counted_cash"]) {
    const v = d[key];
    if (typeof v === "number") return fmtMoney(v);
  }
  return null;
}

function detailOf(e: ActivityItem): string | null {
  const d = e.data ?? {};
  if (typeof d.reason === "string" && d.reason.length > 0) return d.reason;
  if (typeof d.payment_method === "string") return String(d.payment_method);
  if (typeof d.variance === "number") return `variance ${d.variance >= 0 ? "+" : ""}${d.variance.toFixed(2)}`;
  return null;
}

export default function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (!items || items.length === 0) {
    return (
      <div className="empty">
        No events yet — waiting for a register to sync.
      </div>
    );
  }

  return (
    <ul className="feed">
      {items.map((e) => (
        <li key={e.event_id}>
          <span className="feed-time">{fmtUtc(e.occurred_at)}</span>
          <EventBadge type={e.event_type} />
          <span className="feed-detail">
            {amountOf(e) ?? ""}
            {detailOf(e) ? ` · ${detailOf(e)}` : ""}
          </span>
          <span className="feed-meta" title={`event ${e.event_id}`}>
            {e.user_id} @ {e.register_id}
          </span>
        </li>
      ))}
    </ul>
  );
}
