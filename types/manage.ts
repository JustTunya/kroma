import type { StaffRole } from "@/lib/staff-permissions";

/** One hour of the trading day: what came in, and who was there for it. */
export type HourSlice = {
  hour: number;
  orders: number;
  taken: number;
  lost: number;
  /** Orders voided, refunded or binned in this hour. Ticks, not euros. */
  lost_orders: number;
  /** Staff-seconds on shift inside this hour, summed across the range. */
  seconds: number;
};

export type SoldItem = { name: string; qty: number; revenue: number };

export type Earnings = {
  taken: number;
  orders: number;
  average: number;
  online: number;
  counter: number;
  /** Money that left. */
  voided: number;
  refunded: number;
  /** Money that stayed while the coffee went in the bin. Not a lost sale. */
  abandoned: number;
  /** Orders still sitting unpaid on the pass. */
  unpaid: number;
  by_hour: HourSlice[];
  items: SoldItem[];
};

export type BarStat = {
  id: string;
  name: string;
  role: StaffRole;
  on_shift: boolean;
  seconds: number;
  made: number;
  /** Null when nothing they started ever reached ready. */
  median_seconds: number | null;
  under_five: number;
  timed: number;
  eighty_sixed: number;
  voided: number;
  refunded: number;
  stepped_back: number;
};

export type LedgerEntry = {
  id: number;
  action: string;
  created_at: string;
  staff_id: string | null;
  staff_name: string | null;
  station_name: string | null;
  subject_id: string | null;
  order_number: number | null;
  /** Set instead of order_number when the subject is a menu item (item.86). */
  item_name: string | null;
  detail: Record<string, unknown>;
};
