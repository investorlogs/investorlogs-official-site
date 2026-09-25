import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import {
  SmsOrderError,
  computeChargeBreakdown,
  linkActivation,
  purchaseSmsOrder,
  refundSmsOrder,
  serializeSmsOrder,
  smsProviderErrorResponse,
} from "@/lib/sms-orders"
import {
  assertProviderAuthenticated,
  isProviderConfigured,
  requestNumber,
  getProviderCatalog,
} from "@/lib/smsProvider"
import { smsOrderSchema } from "@/lib/validations/sms"

/**
 * Rents a virtual number for the user:
 *   1. atomic wallet debit + PENDING SmsOrder + ledger entry;
 *   2. provider `requestNumber()` outside the transaction;
 *   3. on provider failure the order is compensated automatically
 *      (status CANCELLED + full refund) and the error is surfaced.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id
    const { country, service } = smsOrderSchema.parse(await request.json())

    if (!isProviderConfigured()) {
      return NextResponse.json(
        { error: "SMS numbers are temporarily unavailable. Please try again later.", code: "NOT_CONFIGURED" },
        { status: 503 }
      )
    }

    try {
      await assertProviderAuthenticated()
    } catch (error) {
      const providerResponse = smsProviderErrorResponse(error)
      if (providerResponse) return providerResponse
      throw error
    }

    // 1. Server-side pricing (never trust client pricing). The supplier base
    // cost stays inside this request: the customer is charged base + flat
    // profit markup, and the markup is logged as isolated profit below.
    const cost = (await getProviderCatalog(country))[service]
    if (cost === undefined) {
      return NextResponse.json(
        {
          error: "No numbers are currently available for this country and service.",
          code: "NO_STOCK",
        },
        { status: 409 }
      )
    }
    const { charge, profit } = await computeChargeBreakdown(cost)

    // 2. Atomic debit + order creation + profit allocation.
    let order
    try {
      order = await purchaseSmsOrder(userId, country, service, charge, profit)
    } catch (error) {
      if (error instanceof SmsOrderError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.httpStatus }
        )
      }
      throw error
    }

    // 3. Rent the number from the provider; compensate on failure.
    try {
      const activation = await requestNumber(country, service)
      const updated = await linkActivation(order.id, activation)

      const fresh = await prisma.smsOrder.findUniqueOrThrow({
        where: { id: updated.id },
        include: { user: { select: { walletBalance: true } } },
      })

      return NextResponse.json(
        {
          message: `Number reserved for ${service}. Waiting for your SMS...`,
          order: serializeSmsOrder(fresh),
          newBalance: fresh.user.walletBalance.toNumber(),
        },
        { status: 201 }
      )
    } catch (error) {
      const refunded = await refundSmsOrder(order.id, userId, charge, "CANCELLED").catch(() => false)
      console.error("SMS order compensation:", { orderId: order.id, refunded, error })

      const providerResponse = smsProviderErrorResponse(error)
      if (providerResponse) return providerResponse

      return NextResponse.json(
        { error: "Failed to reserve a number. You have not been charged.", code: "PROVIDER_ERROR" },
        { status: 502 }
      )
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof SmsOrderError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.httpStatus }
      )
    }

    console.error("SMS order error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
