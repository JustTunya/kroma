import { redirect } from "next/navigation";

/** Everyone lands on the pass. The numbers are one tap away. */
export default function DashboardIndex() {
  redirect("/dashboard/board");
}
