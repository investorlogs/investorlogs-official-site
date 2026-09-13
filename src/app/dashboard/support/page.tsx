import { HelpCircle } from "lucide-react"
import { requireSession } from "@/lib/session"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default async function SupportPage() {
  await requireSession("/dashboard/support")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Support</h2>
        <p className="text-muted-foreground">
          Get help with orders, your wallet or your account.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <HelpCircle className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2">
            <CardTitle>Support tickets are coming soon</CardTitle>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <CardDescription>
            A built-in ticketing system is on the way. In the meantime, reach
            out by email and include your order reference (for example
            &ldquo;sms-order-...&rdquo; or &ldquo;acct-...&rdquo; from your
            order history) so we can help you faster.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your wallet transactions and purchased accounts remain available
            under Order History while support is being built.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}