
export const STAFF_ROLES = ["owner", "manager", "staff"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_ACTIONS = [
  "order.view",
  "order.advance",
  "order.note",
  "order.claim",
  "item.86",
  "order.abandon",
  "shop.open",
  "order.void",
  "order.refund",
  "order.discount",
  "order.undo_late",
  "customer.contact",
  "menu.edit",
  "analytics.view",
  "shop.close",
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

    case "item.86":

    case "order.abandon":

    case "shop.open":
      return true;
    case "order.void":
    case "order.refund":
    case "order.discount":
    case "order.undo_late":
    case "customer.contact":
    case "menu.edit":
    case "analytics.view":

    case "shop.close":
      return MANAGER_UP.includes(role);
    case "staff.manage":
    case "shop.settings":
      return role === "owner";
    default:

      return false;
  }
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Owner",
  manager: "Manager",
  staff: "Bar",
};
