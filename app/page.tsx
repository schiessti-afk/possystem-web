import ActivityFeed from "@/components/ActivityFeed";
import ActivityFilters from "@/components/ActivityFilters";
import AutoRefresh from "@/components/AutoRefresh";
import DrawerPanel from "@/components/DrawerPanel";
import Icon from "@/components/Icon";
import MetricCard from "@/components/MetricCard";
import PaymentSplit from "@/components/PaymentSplit";
import { getActivity, getSummary } from "@/lib/data";
import { fmtInt, fmtMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 25;

type Search = { from?: string; to?: string; limit?: string };

function ymd(value?: string): string | undefined {
  if (!value) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function clampLimit(value?: string): number {
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(200, Math.max(1, n));
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const from = ymd(searchParams.from);
  const to = ymd(searchParams.to);
  const limit = clampLimit(searchParams.limit);
  const filtered = Boolean(from || to);
  const [summary, activity] = await Promise.all([
    getSummary(),
    getActivity({ limit, from, to }),
  ]);

  return (
    <>
      <div className="page-head">
        <h1>Overview</h1>
        <AutoRefresh />
      </div>

      {!summary ? (
        <div className="card error">
          <Icon name="offline" size={18} />
          <span>
            Backend unreachable. Start the stack with{" "}
            <code>docker compose up --build</code>.
          </span>
        </div>
      ) : (
        <>
          <section className="grid metrics-grid">
            <MetricCard
              label="Gross revenue (today)"
              value={fmtMoney(summary.metrics.total_revenue)}
              icon="wallet"
            />
            <MetricCard
              label="Net revenue"
              value={fmtMoney(summary.metrics.net_revenue)}
              sub={`${fmtMoney(summary.metrics.total_refunds)} refunded`}
              tone={summary.metrics.total_refunds > 0 ? "warn" : "default"}
              icon="cash"
            />
            <MetricCard
              label="Sales"
              value={fmtInt(summary.metrics.total_sales_count)}
              icon="receipt"
            />
            <MetricCard
              label="Shifts today"
              value={`${summary.metrics.shifts_opened} / ${summary.metrics.shifts_closed}`}
              sub="opened / closed"
              icon="drawer-open"
            />
          </section>

          <section className="grid two-col">
            <PaymentSplit metrics={summary.metrics} />
            <DrawerPanel drawer={summary.drawer} />
          </section>
        </>
      )}

      <section className="card">
        <div className="card-head">
          <div className="card-title">
            <Icon name="receipt" size={16} />
            Recent activity
          </div>
          <ActivityFilters from={from} to={to} limit={limit} />
        </div>
        {activity ? (
          <ActivityFeed items={activity} filtered={filtered} />
        ) : (
          <div className="error">
            <Icon name="offline" size={16} />
            Backend unreachable.
          </div>
        )}
      </section>
    </>
  );
}
