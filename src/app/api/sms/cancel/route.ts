import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import {
  markSmsReceived,
  refundSmsOrder,
  serializeSmsOrder,
  smsProviderErrorResponse,
} from "@/lib/sms-orders"
import { checkSmsCode, cancelOrder } from "@/lib/smsProvider"
import { smsCancelSchema } from "@/lib/validations/sms"

/**
 * Releases a rented number and refunds the wallet.
 *  - reason "user"    → status CANCELLED
 *  - reason "timeout" → status EXPIRED
 * If a code arrived while the user was cancelling, the order is completed
 * instead (no refund — the user got their SMS).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { orderId, reason } = smsCancelSchema.parse(await request.json())

    const order = await prisma.smsOrder.findUnique({ where: { id: orderId } })

    if (!order || order.userId !== session.user.id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    if (order.status !== "PENDING") {
      return NextResponse.json({
        message: "This order is already finalized.",
        order: serializeSmsOrder(order),
      })
    }

    const targetStatus: "CANCELLED" | "EXPIRED" =
      reason === "timeout" ? "EXPIRED" : "CANCELLED"

    // A code may have landed between the last poll and this cancel — in that
    // case the user received value, so finalize instead of refunding.
    if (order.orderId) {
      try {
        const check = await checkSmsCode(order.orderId)
        if (check.code) {
          await markSmsReceived(order.id, check.code)
          return NextResponse.json({
            message: "Your SMS arrived — no refund was needed.",
            order: {
              ...serializeSmsOrder(order),
              status: "RECEIVED",
              code: check.code,
            },
          })
        }
      } catch (error) {
        const providerResponse = smsProviderErrorResponse(error)
        if (providerResponse && providerResponse.status === 429) return providerResponse
        // Other provider hiccups: fall through to the cancel attempt.
      }
    }

    // Best-effort release on the provider side.
    if (order.orderId) {
      try {
        await cancelOrder(order.orderId)
      } catch (error) {
        const providerResponse = smsProviderErrorResponse(error)
        if (providerResponse && providerResponse.status === 429) return providerResponse
        console.error("SMS provider cancel failed:", error)
      }
    }

    const refunded = await refundSmsOrder(
      order.id,
      order.userId,
      order.price,
      targetStatus
    )

    return NextResponse.json({
      message: refunded
        ? `Number released. ₦${order.price.toNumber().toFixed(2)} was refunded to your wallet.`
        : "This order is already finalized.",
      order: {
        ...serializeSmsOrder(order),
        status: targetStatus,
        refunded,
        refundAmount: refunded ? order.price.toNumber() : undefined,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }

    console.error("SMS cancel error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
