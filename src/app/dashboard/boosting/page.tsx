import { redirect } from "next/navigation"

/**
 * Social Boosting is hidden from navigation.
 * Direct visits redirect safely back to the dashboard.
 */
export default async function BoostingPage() {
  redirect("/dashboard")
}
