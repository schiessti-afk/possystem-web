import ActivityFeed from "@/components/ActivityFeed";
import AutoRefresh from "@/components/AutoRefresh";
import DrawerPanel from "@/components/DrawerPanel";
import Icon from "@/components/Icon";
import MetricCard from "@/components/MetricCard";
import PaymentSplit from "@/components/PaymentSplit";
import { getActivity, getSummary } from "@/lib/data";
import { fmtInt, fmtMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [summary, activity] = await Promise.all([getSummary(), getActivity(25)]);

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
        <div className="card-title">
          <Icon name="receipt" size={16} />
          Recent activity
        </div>
        {activity ? (
          <ActivityFeed items={activity} />
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
