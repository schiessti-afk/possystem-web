import Icon, { type IconName } from "./Icon";
import { fmtMoney } from "@/lib/format";
import type { SummaryMetrics } from "@/lib/types";

/**
 * Tender buckets mirror possystem's register buttons:
 * DINHEIRO (cash), DÉBITO (debit), CRÉDITO (credit), PIX.
 */
interface Part {
  key: string;
  label: string;
  pick: (m: SummaryMetrics) => number;
  cls: string;
  icon: IconName;
}

const PARTS: Part[] = [
  { key: "cash", label: "Cash", pick: (m) => m.cash_revenue, cls: "split-cash", icon: "cash" },
  { key: "debit", label: "Debit", pick: (m) => m.debit_revenue, cls: "split-debit", icon: "card-debit" },
  { key: "credit", label: "Credit Card", pick: (m) => m.credit_revenue, cls: "split-credit", icon: "card-credit" },
  { key: "pix", label: "PIX", pick: (m) => m.pix_revenue, cls: "split-pix", icon: "pix" },
];

export default function PaymentSplit({ metrics }: { metrics: SummaryMetrics }) {
  const total = PARTS.reduce((sum, p) => sum + p.pick(metrics), 0);

  return (
    <div className="card">
      <div className="card-title">
        <Icon name="wallet" size={16} />
        Payment split
      </div>
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
                <Icon name={p.icon} size={16} className={`legend-${p.key}`} />
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
