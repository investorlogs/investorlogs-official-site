import { redirect } from "next/navigation"

/**
 * Boosting order history is hidden while Social Boosting is disabled.
 * Direct visits redirect safely back to the dashboard.
 */
export default async function BoostingOrdersPage() {
  redirect("/dashboard")
}
