/** Wire types mirroring vps_backend/app/routes/dashboard.py responses. */

export interface SummaryMetrics {
  total_revenue: number;
  total_refunds: number;
  net_revenue: number;
  total_sales_count: number;
  cash_revenue: number;
  debit_revenue: number;
  credit_revenue: number;
  pix_revenue: number;
  shifts_opened: number;
  shifts_closed: number;
}

export interface DrawerInfo {
  open_session_id: string | null;
  opened_at: string | null;
  expected_cash_in_drawer: number | null;
}

export interface SummaryResponse {
  date: string;
  metrics: SummaryMetrics;
  drawer: DrawerInfo;
}

export interface ActivityItem {
  event_id: string;
  event_type: string;
  occurred_at: string;
  received_at: string;
  user_id: string;
  register_id: string;
  data: Record<string, unknown>;
}

export interface ShiftRow {
  session_id: string;
  user_id: string;
  register_id: string;
  opening_float: number;
  opened_at: string;
  closed_at: string | null;
  counted_cash: number | null;
  expected_cash: number | null;
  variance: number | null;
}
