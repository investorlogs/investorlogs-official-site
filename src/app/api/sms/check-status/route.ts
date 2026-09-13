import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import {
  refundSmsOrder,
  markSmsReceived,
  serializeSmsOrder,
  smsProviderErrorResponse,
} from "@/lib/sms-orders"
import { SMS_ORDER_TTL_MS, SmsProviderError, checkSmsCode, cancelOrder } from "@/lib/smsProvider"
import { smsOrderIdQuerySchema } from "@/lib/validations/sms"

export const dynamic = "force-dynamic"

/**
 * Polling endpoint for the live SMS engine. Safe to call repeatedly:
 * finalized orders return their current state, PENDING orders are checked
 * against the provider, and the 15-minute TTL triggers an automatic
 * release + refund (status EXPIRED).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { orderId } = smsOrderIdQuerySchema.parse({
      orderId: request.nextUrl.searchParams.get("orderId") ?? "",
    })

    const order = await prisma.smsOrder.findUnique({ where: { id: orderId } })

    if (!order || order.userId !== session.user.id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    if (order.status !== "PENDING") {
      return NextResponse.json({ order: serializeSmsOrder(order) })
    }

    // Countdown ran out → release the number and refund.
    if (Date.now() >= order.createdAt.getTime() + SMS_ORDER_TTL_MS) {
      if (order.orderId) {
        await cancelOrder(order.orderId).catch(() => undefined)
      }
      const refunded = await refundSmsOrder(order.id, order.userId, order.price, "EXPIRED")
      return NextResponse.json({
        order: {
          ...serializeSmsOrder(order),
          status: "EXPIRED",
          refunded,
          refundAmount: refunded ? order.price.toNumber() : undefined,
        },
      })
    }

    if (!order.orderId) {
      return NextResponse.json({ order: serializeSmsOrder(order) })
    }

    try {
      const result = await checkSmsCode(order.orderId)

      // Code arrived → RECEIVED (the schema's "completed" state).
      if (result.code) {
        await markSmsReceived(order.id, result.code)
        const fresh = await prisma.smsOrder.findUniqueOrThrow({
          where: { id: order.id },
        })
        return NextResponse.json({ order: serializeSmsOrder(fresh) })
      }

      // Provider ended the activation on its own (canceled externally or
      // timed out at the provider) → refund.
      if (result.status === "CANCELLED" || result.status === "EXPIRED") {
        const refunded = await refundSmsOrder(order.id, order.userId, order.price, result.status)
        return NextResponse.json({
          order: {
            ...serializeSmsOrder(order),
            status: result.status,
            refunded,
            refundAmount: refunded ? order.price.toNumber() : undefined,
          },
        })
      }

      return NextResponse.json({ order: serializeSmsOrder(order) })
    } catch (error) {
      // Provider lost track of the activation → treat as expired + refund.
      if (error instanceof z.ZodError) throw error
      if (error instanceof SmsProviderError && error.code === "INVALID_ORDER") {
        const refunded = await refundSmsOrder(order.id, order.userId, order.price, "EXPIRED")
        return NextResponse.json({
          order: {
            ...serializeSmsOrder(order),
            status: "EXPIRED",
            refunded,
            refundAmount: refunded ? order.price.toNumber() : undefined,
          },
        })
      }

      const providerResponse = smsProviderErrorResponse(error)
      if (providerResponse) return providerResponse
      throw error
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }

    console.error("SMS check-status error:", error)
    return NextResponse.json(
      { error: "Could not check SMS status. It will retry automatically." },
      { status: 500 }
    )
  }
}
