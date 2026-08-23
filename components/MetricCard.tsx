interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn" | "bad";
}

export default function MetricCard({ label, value, sub, tone }: MetricCardProps) {
  return (
    <div className={`card metric${tone && tone !== "default" ? ` tone-${tone}` : ""}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {sub ? <div className="metric-sub">{sub}</div> : null}
    </div>
  );
}
