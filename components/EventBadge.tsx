import Icon, { type IconName } from "./Icon";

const LABELS: Record<string, string> = {
  SALE: "Sale",
  REFUND: "Refund",
  CASH_IN: "Cash in",
  CASH_OUT: "Cash out",
  REGISTER_OPENED: "Shift opened",
  REGISTER_CLOSED: "Shift closed",
};

const ICONS: Record<string, IconName> = {
  SALE: "receipt",
  REFUND: "refund",
  CASH_IN: "cash-in",
  CASH_OUT: "drop",
  REGISTER_OPENED: "drawer-open",
  REGISTER_CLOSED: "drawer-close",
};

export default function EventBadge({ type }: { type: string }) {
  const icon = ICONS[type];
  return (
    <span className={`badge b-${type.toLowerCase()}`}>
      {icon ? <Icon name={icon} size={13} /> : null}
      {LABELS[type] ?? type}
    </span>
  );
}
