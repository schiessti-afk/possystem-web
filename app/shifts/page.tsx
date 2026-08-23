import AutoRefresh from "@/components/AutoRefresh";
import Icon from "@/components/Icon";
import { getShifts } from "@/lib/data";
import { fmtMoney, fmtUtc } from "@/lib/format";

export const dynamic = "force-dynamic";

function VarianceChip({ variance }: { variance: number | null }) {
  if (variance == null) {
    return (
      <span className="chip chip-open">
        <Icon name="drawer-open" size={13} />
        open
      </span>
    );
  }
  const abs = Math.abs(variance);
  const cls = abs <= 0.5 ? "chip-ok" : abs <= 2 ? "chip-warn" : "chip-bad";
  const icon = abs <= 0.5 ? "synced" : "alert";
  const sign = variance > 0 ? "+" : "";
  return (
    <span className={`chip ${cls}`}>
      <Icon name={icon} size={13} />
      {sign}{variance.toFixed(2)}
    </span>
  );
}

export default async function ShiftsPage() {
  const shifts = await getShifts(50);

  return (
    <>
      <div className="page-head">
        <h1>Register shifts</h1>
        <AutoRefresh />
      </div>

      <div className="card">
        {!shifts ? (
          <div className="error">
            <Icon name="offline" size={16} />
            Backend unreachable.
          </div>
        ) : shifts.length === 0 ? (
          <div className="empty">
            <Icon name="drawer-close" size={16} />
            No shifts recorded yet.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Session</th>
                <th>Register</th>
                <th>User</th>
                <th className="num">Float</th>
                <th>Opened</th>
                <th>Closed</th>
                <th className="num">Counted</th>
                <th className="num">Expected</th>
                <th>Variance</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s.session_id} className={s.closed_at ? "" : "row-open"}>
                  <td>
                    <code>{s.session_id}</code>
                  </td>
                  <td>{s.register_id}</td>
                  <td>{s.user_id}</td>
                  <td className="num">{fmtMoney(s.opening_float)}</td>
                  <td>{fmtUtc(s.opened_at)}</td>
                  <td>{s.closed_at ? fmtUtc(s.closed_at) : "—"}</td>
                  <td className="num">{s.counted_cash != null ? fmtMoney(s.counted_cash) : "—"}</td>
                  <td className="num">{s.expected_cash != null ? fmtMoney(s.expected_cash) : "—"}</td>
                  <td><VarianceChip variance={s.variance} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="hint">
        Variance = counted − expected, as computed by the register at closing.
      </p>
    </>
  );
}
