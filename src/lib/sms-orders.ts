import { Prisma } from "@/generated/prisma/client"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getConfigNumber } from "@/lib/config"
import { SMS_ORDER_TTL_MS } from "@/lib/sms-catalog"
import { SmsProviderError, type SmsActivation } from "@/lib/smsProvider"

/**
 * Server-side SMS order lifecycle helpers (Phase 3).
 *
 * Money handling mirrors the Phase 2 purchase engine:
 *  - the wallet debit is a conditional `UPDATE ... WHERE walletBalance >= charge`
 *    so the check-and-deduct is atomic under concurrency;
 *  - every debit/refund writes a WalletTransaction ledger entry with a
 *    deterministic unique reference (`sms-order-<id>` / `sms-refund-<id>`),
 *    making refunds idempotent by construction;
 *  - provider HTTP calls are never made inside a database transaction.
 */

/**
 * Flat naira profit applied to every SMS number sale. Used when neither the
 * `SMS_PROFIT_MARKUP_NGN` config row nor the env var is set.
 */
export const DEFAULT_PROFIT_MARKUP_NGN = 1000
/** Reference prefix for the internal profit ledger entry of an order. */
const PROFIT_REFERENCE_PREFIX = "sms-profit-"

export class SmsOrderError extends Error {
  constructor(
    public code:
      | "INSUFFICIENT_BALANCE"
      | "ALREADY_FINALIZED"
      | "ORDER_NOT_FOUND",
    message: string,
    public httpStatus: number
  ) {
    super(message)
  }
}

// ---------------------------------------------------------------------------
// Pricing: fixed white-label profit markup
// ---------------------------------------------------------------------------
//
// SMS numbers are sold at   customerPrice = supplierBaseCost + PROFIT_MARKUP
// where PROFIT_MARKUP is a flat naira amount (₦1,000 by default). The markup is
// configurable via the `SMS_PROFIT_MARKUP_NGN` config row / env var so it can be
// changed without a deploy, but it is never a percentage of the supplier rate.
//
// The supplier base cost is INTERNAL ONLY. It must never reach the client — the
// customer sees a single, all-inclusive price and the platform appears as the
// direct provider.

/** Flat profit added to every SMS number sale, in naira. */
export async function getProfitMarkup(): Promise<Prisma.Decimal> {
  const configured = await getConfigNumber(
    "SMS_PROFIT_MARKUP_NGN",
    Number(process.env.SMS_PROFIT_MARKUP_NGN) || DEFAULT_PROFIT_MARKUP_NGN
  )
  return new Prisma.Decimal(configured).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
}

/**
 * Splits a supplier base cost into the amount the customer pays and the
 * profit share retained by the platform.
 *
 *   cost   = supplier base cost (e.g. ₦500)
 *   charge = cost + profit markup (e.g. ₦1,500)
 *   profit = the flat markup (e.g. ₦1,000)
 *
 * `charge` and `profit` are both rounded to 2dp so they always reconcile
 * exactly (`charge - profit === cost`), which keeps the ledger balanced.
 */
export async function computeChargeBreakdown(cost: number): Promise<{
  charge: Prisma.Decimal
  profit: Prisma.Decimal
}> {
  const baseCost = new Prisma.Decimal(cost).toDecimalPlaces(2, Prisma.Decimal.ROUND_UP)
  const profit = await getProfitMarkup()
  const charge = baseCost.plus(profit)
  return { charge, profit }
}

/** The all-inclusive customer price for a supplier base cost. */
export async function computeCharge(cost: number): Promise<Prisma.Decimal> {
  return (await computeChargeBreakdown(cost)).charge
}

/**
 * Atomically debits the wallet, creates the PENDING SmsOrder, and writes its
 * PURCHASE ledger entry plus the isolated SMS_PROFIT entry that records the
 * platform's flat markup.
 *
 * The whole set is one transaction: either the wallet is debited AND the profit
 * is booked, or nothing happens at all. Throws INSUFFICIENT_BALANCE (402)
 * without touching anything if funds are low.
 *
 * `profit` is the flat markup contained in `charge`. It is logged as a separate
 * ledger row (positive amount, internal-only type) so earnings can be reported
 * without touching the customer-facing PURCHASE line.
 */
export async function purchaseSmsOrder(
  userId: string,
  country: string,
  service: string,
  charge: Prisma.Decimal,
  profit: Prisma.Decimal
) {
  return prisma.$transaction(async (tx) => {
    const debit = await tx.user.updateMany({
      where: { id: userId, walletBalance: { gte: charge } },
      data: { walletBalance: { decrement: charge } },
    })

    if (debit.count === 0) {
      throw new SmsOrderError(
        "INSUFFICIENT_BALANCE",
        "Insufficient wallet balance for this order. Please top up and try again.",
        402
      )
    }

    const order = await tx.smsOrder.create({
      data: {
        userId,
        country,
        service,
        price: charge,
        status: "PENDING",
      },
    })

    // Customer-facing charge (what leaves their wallet).
    await tx.walletTransaction.create({
      data: {
        userId,
        amount: charge.negated(),
        type: "PURCHASE",
        status: "COMPLETED",
        reference: `sms-order-${order.id}`,
      },
    })

    // Internal profit allocation for this sale. Only written when there is a
    // positive margin; a zero-markup config would otherwise leave an empty row.
    if (profit.greaterThan(0)) {
      await tx.walletTransaction.create({
        data: {
          userId,
          amount: profit,
          type: "SMS_PROFIT",
          status: "COMPLETED",
          reference: `${PROFIT_REFERENCE_PREFIX}${order.id}`,
        },
      })
    }

    return order
  })
}

/** Stores the provider activation on our order (with one retry). */
export async function linkActivation(orderId: string, activation: SmsActivation) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await prisma.smsOrder.update({
        where: { id: orderId },
        data: { orderId: activation.orderId, phoneNumber: activation.phoneNumber },
      })
    } catch (error) {
      if (attempt === 1) throw error
    }
  }
  throw new Error("unreachable")
}

/** Marks the order RECEIVED with its verification code (idempotent). */
export async function markSmsReceived(orderId: string, code: string) {
  await prisma.smsOrder.updateMany({
    where: { id: orderId, status: "PENDING" },
    data: { status: "RECEIVED", code },
  })
}

/**
 * Finalizes a PENDING order as CANCELLED/EXPIRED and refunds the wallet.
 * Idempotent: the status guard ensures a second call is a no-op, and the
 * deterministic ledger reference makes double refunds impossible.
 */
export async function refundSmsOrder(
  orderId: string,
  userId: string,
  amount: Prisma.Decimal,
  status: "CANCELLED" | "EXPIRED"
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.smsOrder.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status },
    })

    if (updated.count === 0) return false

    await tx.walletTransaction.create({
      data: {
        userId,
        amount,
        type: "REFUND",
        status: "COMPLETED",
        reference: `sms-refund-${orderId}`,
      },
    })

    // A refunded order earned no profit. Reverse the original SMS_PROFIT entry
    // with a negating row (deterministic reference so it is idempotent) so the
    // earnings ledger nets to zero for this sale. The customer is still made
    // whole for the full charge, markup included.
    const profitEntry = await tx.walletTransaction.findUnique({
      where: { reference: `${PROFIT_REFERENCE_PREFIX}${orderId}` },
      select: { amount: true },
    })
    if (profitEntry && profitEntry.amount.greaterThan(0)) {
      await tx.walletTransaction.create({
        data: {
          userId,
          amount: profitEntry.amount.negated(),
          type: "SMS_PROFIT",
          status: "COMPLETED",
          reference: `${PROFIT_REFERENCE_PREFIX}reversal-${orderId}`,
        },
      })
    }

    await tx.user.update({
      where: { id: userId },
      data: { walletBalance: { increment: amount } },
    })

    return true
  })
}

/**
 * Maps a SmsProviderError to a JSON HTTP response; null when not one.
 *
 * WHITE-LABEL: the raw provider message names the upstream vendor, so the
 * customer-facing text below is generic. Full detail goes to the server log.
 */
export function smsProviderErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof SmsProviderError) {
    const publicMessages: Record<string, string> = {
      NO_STOCK: "No numbers are currently available for this selection.",
      RATE_LIMITED: "We are handling a lot of requests right now. Please retry shortly.",
      AUTH_FAILED: "This service is temporarily unavailable. Please try again later.",
      NETWORK_ERROR: "We could not complete that request. Please try again.",
      NOT_CONFIGURED: "This service is temporarily unavailable. Please try again later.",
      INVALID_ORDER: "That number rental is no longer available.",
      PROVIDER_ERROR: "We could not complete that request. Please try again.",
    }
    console.error("SMS upstream error:", { code: error.code, message: error.message })
    return NextResponse.json(
      { error: publicMessages[error.code] ?? "Something went wrong. Please try again.", code: error.code },
      { status: error.httpStatus }
    )
  }
  return null
}

type SmsOrderWithUser = Prisma.SmsOrderGetPayload<{ include: { user: { select: { walletBalance: true } } } }>

/** Shapes an SmsOrder for API responses (Decimal → number, TTL applied). */
export function serializeSmsOrder(
  order: Pick<
    SmsOrderWithUser,
    "id" | "status" | "code" | "phoneNumber" | "price" | "country" | "service" | "createdAt"
  >,
  extra?: { refunded?: boolean; refundAmount?: number }
) {
  return {
    id: order.id,
    status: order.status,
    code: order.code,
    phoneNumber: order.phoneNumber,
    country: order.country,
    service: order.service,
    price: order.price.toNumber(),
    createdAt: order.createdAt.toISOString(),
    expiresAt: new Date(order.createdAt.getTime() + SMS_ORDER_TTL_MS).toISOString(),
    ...extra,
  }
}
