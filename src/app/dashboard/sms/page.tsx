import { requireSession } from "@/lib/session"
import { SmsClient } from "./sms-client"

export default async function SmsPage() {
  await requireSession("/dashboard/sms")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Get SMS Numbers
        </h2>
        <p className="text-muted-foreground">
          Rent a virtual number, receive your verification code instantly, and
          pay only from your wallet balance.
        </p>
      </div>

      <SmsClient />
    </div>
  )
}
