/** Wire types mirroring vps_backend/app/routes/dashboard.py responses. */

export interface SummaryMetrics {
  total_revenue: number;
  /** Gross for the current calendar month, regardless of the window. */
  month_revenue: number;
  total_refunds: number;
  net_revenue: number;
  total_sales_count: number;
  cash_revenue: number;
  debit_revenue: number;
  credit_revenue: number;
  pix_revenue: number;
  shifts_opened: number;
  shifts_closed: number;
  /** First REGISTER_OPENED in the window; null if nobody logged in. */
  first_login_at: string | null;
  /** Last REGISTER_CLOSED in the window; null while every shift is open. */
  last_logout_at: string | null;
}

export interface DrawerInfo {
  open_session_id: string | null;
  opened_at: string | null;
  expected_cash_in_drawer: number | null;
}

export interface SummaryResponse {
  date: string;
  from: string | null;
  to: string | null;
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
