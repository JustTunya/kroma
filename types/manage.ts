import type { StaffRole } from "@/lib/staff-permissions";

export type HourSlice = {
  hour: number;
  orders: number;
  taken: number;
  lost: number;

  lost_orders: number;

  seconds: number;
};

export type SoldItem = { name: string; qty: number; revenue: number };

export type Earnings = {
  taken: number;
  orders: number;
  average: number;
  online: number;
  counter: number;

  voided: number;
  refunded: number;

  abandoned: number;

  unpaid: number;

  latest: string | null;
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

  item_name: string | null;
  detail: Record<string, unknown>;
};
