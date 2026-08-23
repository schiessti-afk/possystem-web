import { fmtMoney } from "@/lib/format";
import type { SummaryMetrics } from "@/lib/types";

/**
 * Tender buckets mirror possystem's register buttons:
 * DINHEIRO (cash), DÉBITO (debit), CRÉDITO (credit), PIX.
 * 'card'/'other' only exist on rows synced before the migration.
 */
interface Part {
  key: string;
  label: string;
  pick: (m: SummaryMetrics) => number;
  cls: string;
  hideWhenZero?: boolean;
}

const PARTS: Part[] = [
  { key: "cash", label: "Cash", pick: (m) => m.cash_revenue, cls: "split-cash" },
  { key: "debit", label: "Debit", pick: (m) => m.debit_revenue, cls: "split-debit" },
  { key: "credit", label: "Credit Card", pick: (m) => m.credit_revenue, cls: "split-credit" },
  { key: "pix", label: "PIX", pick: (m) => m.pix_revenue, cls: "split-pix" },
  {
    key: "legacy",
    label: "Legacy (card/other)",
    pick: (m) => m.legacy_revenue,
    cls: "split-legacy",
    hideWhenZero: true,
  },
];

export default function PaymentSplit({ metrics }: { metrics: SummaryMetrics }) {
  const visible = PARTS.filter((p) => !(p.hideWhenZero && p.pick(metrics) === 0));
  const total = visible.reduce((sum, p) => sum + p.pick(metrics), 0);

  return (
    <div className="card">
      <div className="card-title">Payment split</div>
      {total <= 0 ? (
        <div className="empty">No sales yet today.</div>
      ) : (
        <>
          <div className="split-bar" role="img" aria-label="Revenue by payment method">
            {visible.map((p) => (
              <div
                key={p.key}
                className={p.cls}
                style={{ width: `${(p.pick(metrics) / total) * 100}%` }}
              />
            ))}
          </div>
          <ul className="legend">
            {visible.map((p) => (
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
