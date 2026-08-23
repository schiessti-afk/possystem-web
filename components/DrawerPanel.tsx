import Icon from "./Icon";
import { fmtMoney, fmtUtc } from "@/lib/format";
import type { DrawerInfo } from "@/lib/types";

export default function DrawerPanel({ drawer }: { drawer: DrawerInfo }) {
  const open = drawer.open_session_id != null;

  if (!open) {
    return (
      <div className="card">
        <div className="card-title">
          <Icon name="drawer-close" size={16} />
          Drawer
        </div>
        <div className="metric-value dim">No shift open</div>
        <div className="metric-sub">
          Expected cash appears here while a register session is open.
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">
        <Icon name="drawer-open" size={16} />
        Drawer
      </div>
      <div className="metric-value">{fmtMoney(drawer.expected_cash_in_drawer)}</div>
      <div className="metric-sub">expected cash in drawer</div>
      <dl className="kv">
        <dt>Session</dt>
        <dd>
          <code>{drawer.open_session_id}</code>
        </dd>
        <dt>Opened</dt>
        <dd>{fmtUtc(drawer.opened_at)}</dd>
      </dl>
    </div>
  );
}
