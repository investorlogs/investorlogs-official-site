import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSmmOrderStatus, isSmmProviderConfigured, type SmmProviderStatus } from "@/lib/smmProvider"
import { syncSmmOrderStatus } from "@/lib/smm-orders"

/**
 * Background sync that polls the SMM provider for the status of every
 * in-flight order. Designed to be called by a cron job or external scheduler:
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://yoursite.com/api/cron/smm-status
 *
 * The `CRON_SECRET` environment variable must match. Returns a JSON summary.
 */
export async function GET(request: Request) {
  const secret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isSmmProviderConfigured()) {
    return NextResponse.json(
      { error: "SMM provider is not configured.", code: "NOT_CONFIGURED" },
      { status: 503 }
    )
  }

  const orders = await prisma.smmOrder.findMany({
    where: { status: { in: ["PENDING", "PROCESSING"] } },
  })

  let updated = 0
  let skipped = 0
  let errored = 0
  const details: Array<{ id: string; oldStatus: string; newStatus: string }> = []

  for (const order of orders) {
    if (!order.externalOrderId) {
      skipped++
      continue
    }

    try {
      const result = await getSmmOrderStatus(order.externalOrderId)
      const changed = await syncSmmOrderStatus(
        order.id,
        order.externalOrderId,
        result.status
      )

      if (changed) {
        updated++
        details.push({
          id: order.id,
          oldStatus: order.status,
          newStatus: mapResultStatus(result.status),
        })
      } else {
        skipped++
      }
    } catch {
      errored++
    }
  }

  return NextResponse.json({
    synced: orders.length,
    updated,
    skipped,
    errored,
    details,
  })
}

function mapResultStatus(status: SmmProviderStatus): string {
  const map: Record<SmmProviderStatus, string> = {
    Pending: "PENDING",
    Processing: "PROCESSING",
    Completed: "COMPLETED",
    Canceled: "CANCELLED",
    Partial: "PARTIAL",
  }
  return map[status] ?? status
}
