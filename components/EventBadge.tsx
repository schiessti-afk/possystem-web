const LABELS: Record<string, string> = {
  SALE: "Sale",
  REFUND: "Refund",
  CASH_IN: "Cash in",
  CASH_OUT: "Cash out",
  REGISTER_OPENED: "Shift opened",
  REGISTER_CLOSED: "Shift closed",
};

export default function EventBadge({ type }: { type: string }) {
  return (
    <span className={`badge b-${type.toLowerCase()}`}>{LABELS[type] ?? type}</span>
  );
}
