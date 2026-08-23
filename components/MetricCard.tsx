import Icon, { type IconName } from "./Icon";

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn" | "bad";
  icon?: IconName;
}

export default function MetricCard({ label, value, sub, tone, icon }: MetricCardProps) {
  return (
    <div className={`card metric${tone && tone !== "default" ? ` tone-${tone}` : ""}`}>
      <div className="metric-head">
        <div className="metric-label">{label}</div>
        {icon ? <Icon name={icon} className="metric-icon" /> : null}
      </div>
      <div className="metric-value">{value}</div>
      {sub ? <div className="metric-sub">{sub}</div> : null}
    </div>
  );
}
