import { fmtMoney } from "@/lib/format";
import type { SummaryMetrics } from "@/lib/types";

const PARTS = [
  { key: "cash", label: "Cash", pick: (m: SummaryMetrics) => m.cash_revenue, cls: "split-cash" },
  { key: "card", label: "Card", pick: (m: SummaryMetrics) => m.card_revenue, cls: "split-card" },
  { key: "other", label: "Other", pick: (m: SummaryMetrics) => m.other_revenue, cls: "split-other" },
] as const;

export default function PaymentSplit({ metrics }: { metrics: SummaryMetrics }) {
  const total = PARTS.reduce((sum, p) => sum + p.pick(metrics), 0);

  return (
    <div className="card">
      <div className="card-title">Payment split</div>
      {total <= 0 ? (
        <div className="empty">No sales yet today.</div>
      ) : (
        <>
          <div className="split-bar" role="img" aria-label="Revenue by payment method">
            {PARTS.map((p) => (
              <div
                key={p.key}
                className={p.cls}
                style={{ width: `${(p.pick(metrics) / total) * 100}%` }}
              />
            ))}
          </div>
          <ul className="legend">
            {PARTS.map((p) => (
              <li key={p.key}>
                <span className={`dot ${p.cls}`} aria-hidden />
                <span>{p.label}</span>
                <strong>{fmtMoney(p.pick(metrics))}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
