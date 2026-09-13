import { requireSession } from "@/lib/session"
import { SmmClient } from "./smm-client"

export default async function BoostingPage() {
  await requireSession("/dashboard/boosting")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Social Boosting</h2>
        <p className="text-muted-foreground">
          Order followers, likes and views for your social accounts. Prices
          include a service margin and are charged to your wallet balance.
        </p>
      </div>

      <SmmClient />
    </div>
  )
}
