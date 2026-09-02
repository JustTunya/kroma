
export type DayReport = {
  day: string;
  opened_at: string;
  closed_at: string | null;
  float: number;
  orders: number;
  taken: number;
  net: number;
  vat: number;
  cash: number;
  card: number;
  online: number;
  discounted: number;
  voided: number;
  refunded: number;
  binned: number;
  cash_refunded: number;
  expected_cash: number;
  left: { name: string; left: number }[];
  live: { id: string; number: number }[];

  counted?: number;
  variance?: number;
};
