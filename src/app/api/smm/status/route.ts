import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { serializeSmmOrder, syncSmmOrderStatus, smmProviderErrorResponse } from "@/lib/smm-orders"
import { getSmmOrderStatus } from "@/lib/smmProvider"
import { smmOrderIdQuerySchema } from "@/lib/validations/smm"

export const dynamic = "force-dynamic"

/**
 * Polling endpoint for the SMM engine. Safe to call repeatedly:
 * finalized orders return their current state, in-flight orders are checked
 * against the provider, and provider statuses are synced to the local record.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { orderId } = smmOrderIdQuerySchema.parse({
      orderId: request.nextUrl.searchParams.get("orderId") ?? "",
    })

    const order = await prisma.smmOrder.findUnique({
      where: { id: orderId },
      include: { user: { select: { walletBalance: true } } },
    })

    if (!order || order.userId !== session.user.id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Finalized orders — return current state without hitting the provider.
    if (order.status !== "PENDING" && order.status !== "PROCESSING") {
      return NextResponse.json({ order: serializeSmmOrder(order) })
    }

    if (!order.externalOrderId) {
      return NextResponse.json({ order: serializeSmmOrder(order) })
    }

    try {
      const result = await getSmmOrderStatus(order.externalOrderId)

      const changed = await syncSmmOrderStatus(
        order.id,
        order.externalOrderId,
        result.status
      )

      if (changed) {
        const fresh = await prisma.smmOrder.findUniqueOrThrow({
          where: { id: order.id },
        })
        return NextResponse.json({ order: serializeSmmOrder(fresh, { progress: result.spent }) })
      }

      // Status unchanged — still report progress if available.
      return NextResponse.json({
        order: serializeSmmOrder(order, {
          progress: result.spent,
          remains: result.remaining,
        }),
      })
    } catch (error) {
      const providerResponse = smmProviderErrorResponse(error)
      if (providerResponse) return providerResponse

      console.error("SMM status check error:", error)
      return NextResponse.json(
        { error: "Could not check order status. It will retry automatically." },
        { status: 500 }
      )
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }

    console.error("SMM status error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
