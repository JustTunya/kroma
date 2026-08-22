/**
 * The TypeScript half of staff_can().
 *
 * Its ONLY job is hiding buttons a person cannot use. The authorization
 * decision is made in SQL, inside the security definer RPC, every single time —
 * advance_order() re-reads the role from the database and does not trust
 * anything the client sends. staff-permissions.test.ts and staff.test.sql
 * assert the same table, which is what keeps the two from drifting.
 */
export const STAFF_ROLES = ["owner", "manager", "staff"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_ACTIONS = [
  "order.view",
  "order.advance",
  "order.note",
  "order.claim",
  "item.86",
  "order.void",
  "order.refund",
  "order.discount",
  "order.undo_late",
  "customer.contact",
  "menu.edit",
  "analytics.view",
  "staff.manage",
  "shop.settings",
] as const;
export type StaffAction = (typeof STAFF_ACTIONS)[number];

const MANAGER_UP: StaffRole[] = ["owner", "manager"];

export function staffCan(role: StaffRole, action: StaffAction): boolean {
  switch (action) {
    case "order.view":
    case "order.advance":
    case "order.note":
    case "order.claim":
    // The person who finds the tray empty is the one holding it. Making them
    // fetch a manager means the storefront keeps selling something that is gone.
    case "item.86":
      return true;
    case "order.void":
    case "order.refund":
    case "order.discount":
    case "order.undo_late":
    case "customer.contact":
    case "menu.edit":
    case "analytics.view":
      return MANAGER_UP.includes(role);
    case "staff.manage":
    case "shop.settings":
      return role === "owner";
    default:
      // A typo denies rather than grants.
      return false;
  }
}

/** How a role is named on screen. "Bar" reads better over a pass than "Staff". */
export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Owner",
  manager: "Manager",
  staff: "Bar",
};
