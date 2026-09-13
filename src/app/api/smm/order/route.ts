import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import {
  SmmOrderError,
  computeSmmCharge,
  computeSmmProfit,
  linkSmmExternalOrder,
  purchaseSmmOrder,
  recordSmmProfit,
  serializeSmmOrder,
  smmProviderErrorResponse,
} from "@/lib/smm-orders"
import {
  createSmmOrder,
  getSmmCatalog,
  isSmmProviderConfigured,
} from "@/lib/smmProvider"
import { smmOrderSchema } from "@/lib/validations/smm"

export const dynamic = "force-dynamic"

/**
 * Places an SMM boosting order:
 *   1. atomic wallet debit + PENDING SmmOrder + PURCHASE ledger entry;
 *   2. provider `createSmmOrder()` outside the transaction;
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
    const { serviceId, targetLink, quantity, total: clientTotal } = smmOrderSchema.parse(
      await request.json()
    )

    if (!isSmmProviderConfigured()) {
      return NextResponse.json(
        { error: "SMM provider is not configured. Please try again later.", code: "NOT_CONFIGURED" },
        { status: 503 }
      )
    }

    // 1. Server-side price from the provider (never trust client pricing).
    const services = await getSmmCatalog()
    const service = services.find((s) => s.serviceId === serviceId)
    if (!service) {
      return NextResponse.json(
        { error: "This service is no longer available.", code: "NO_STOCK" },
        { status: 409 }
      )
    }

    if (quantity < service.minQty || quantity > service.maxQty) {
      return NextResponse.json(
        {
          error: `Quantity must be between ${service.minQty} and ${service.maxQty} for ${service.name}.`,
          code: "INVALID_QUANTITY",
        },
        { status: 400 }
      )
    }

    const charge = await computeSmmCharge(service.rate, quantity)

    // Cross-check an optional client-supplied total so a tampered or stale price
    // is rejected before any money moves. The server charge stays authoritative.
    if (
      clientTotal !== undefined &&
      Math.abs(charge.toNumber() - clientTotal) > 0.01
    ) {
      return NextResponse.json(
        { error: "Price changed. Please refresh and try again.", code: "INVALID_TOTAL" },
        { status: 409 }
      )
    }

    // 2. Atomic debit + order creation.
    let order
    try {
      order = await purchaseSmmOrder(
        userId,
        serviceId,
        service.name,
        service.platform,
        targetLink,
        quantity,
        charge
      )
    } catch (error) {
      if (error instanceof SmmOrderError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.httpStatus }
        )
      }
      throw error
    }

    // 3. Submit to the provider; compensate on failure.
    try {
      const result = await createSmmOrder(serviceId, targetLink, quantity)
      await linkSmmExternalOrder(order.id, result.externalOrderId)

      // 4. Calculate and record the 40% profit immediately after successful order placement
      const profit = await computeSmmProfit(charge, service.rate, quantity)
      await recordSmmProfit(userId, order.id, profit)

      const fresh = await prisma.smmOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: { user: { select: { walletBalance: true } } },
      })

      return NextResponse.json(
        {
          message: `Order placed for ${service.name}. It is being processed.`,
          order: serializeSmmOrder(fresh),
          newBalance: fresh.user.walletBalance.toNumber(),
        },
        { status: 201 }
      )
    } catch (error) {
      const refunded = await cancelAndRefundSmmOrder(order.id, userId, charge).catch(() => false)
      console.error("SMM order compensation:", { orderId: order.id, refunded, error })

      const providerResponse = smmProviderErrorResponse(error)
      if (providerResponse) return providerResponse

      return NextResponse.json(
        { error: "Failed to place the order. You have not been charged.", code: "PROVIDER_ERROR" },
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
    if (error instanceof SmmOrderError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.httpStatus }
      )
    }

    console.error("SMM order error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function cancelAndRefundSmmOrder(
  orderId: string,
  userId: string,
  amount: Prisma.Decimal
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.smmOrder.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status: "CANCELLED" },
    })

    if (updated.count === 0) return false

    // Refund the full amount to the user
    await tx.walletTransaction.create({
      data: {
        userId,
        amount,
        type: "REFUND",
        status: "COMPLETED",
        reference: `smm-refund-${orderId}`,
      },
    })

    await tx.user.update({
      where: { id: userId },
      data: { walletBalance: { increment: amount } },
    })

    // Remove the profit transaction if it exists
    await tx.walletTransaction.deleteMany({
      where: {
        userId,
        type: "SMM_PROFIT",
        reference: `smm-profit-${orderId}`,
      },
    })

    return true
  })
}
