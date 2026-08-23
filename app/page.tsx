import ActivityFeed from "@/components/ActivityFeed";
import AutoRefresh from "@/components/AutoRefresh";
import DrawerPanel from "@/components/DrawerPanel";
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
          Backend unreachable. Start the stack with{" "}
          <code>docker compose up --build</code>.
        </div>
      ) : (
        <>
          <section className="grid metrics-grid">
            <MetricCard
              label="Gross revenue (today)"
              value={fmtMoney(summary.metrics.total_revenue)}
            />
            <MetricCard
              label="Net revenue"
              value={fmtMoney(summary.metrics.net_revenue)}
              sub={`${fmtMoney(summary.metrics.total_refunds)} refunded`}
              tone={summary.metrics.total_refunds > 0 ? "warn" : "default"}
            />
            <MetricCard
              label="Sales"
              value={fmtInt(summary.metrics.total_sales_count)}
            />
            <MetricCard
              label="Shifts today"
              value={`${summary.metrics.shifts_opened} / ${summary.metrics.shifts_closed}`}
              sub="opened / closed"
            />
          </section>

          <section className="grid two-col">
            <PaymentSplit metrics={summary.metrics} />
            <DrawerPanel drawer={summary.drawer} />
          </section>
        </>
      )}

      <section className="card">
        <div className="card-title">Recent activity</div>
        {activity ? (
          <ActivityFeed items={activity} />
        ) : (
          <div className="error">Backend unreachable.</div>
        )}
      </section>
    </>
  );
}
