import { Prisma, SmmStatus } from "@/generated/prisma/client"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getConfigNumber } from "@/lib/config"
import { SmmProviderError, type SmmProviderStatus } from "@/lib/smmProvider"

/**
 * Server-side SMM order lifecycle helpers (Phase 4).
 *
 * Money handling mirrors the Phase 2/3 purchase engine:
 *  - the wallet debit is a conditional `UPDATE ... WHERE walletBalance >= charge`
 *    so the check-and-deduct is atomic under concurrency;
 *  - every debit/refund writes a WalletTransaction ledger entry with a
 *    deterministic unique reference (`smm-order-<id>`), making refunds
 *    idempotent by construction;
 *  - provider HTTP calls are never made inside a database transaction.
 */

export class SmmOrderError extends Error {
  constructor(
    public code: "INSUFFICIENT_BALANCE" | "ALREADY_FINALIZED" | "ORDER_NOT_FOUND",
    message: string,
    public httpStatus: number
  ) {
    super(message)
  }
}

/** Maps a provider status to the local SmmStatus enum value. */
export function mapProviderStatusToEnum(status: SmmProviderStatus): SmmStatus {
  switch (status) {
    case "Processing":
      return "PROCESSING"
    case "Completed":
      return "COMPLETED"
    case "Canceled":
      return "CANCELLED"
    case "Partial":
      return "PARTIAL"
    default:
      return "PENDING"
  }
}

/** Maps a local SmmStatus enum value back to a provider-style status string. */
export function mapEnumToProviderStatus(status: SmmStatus): string {
  switch (status) {
    case "PROCESSING":
      return "Processing"
    case "COMPLETED":
      return "Completed"
    case "CANCELLED":
      return "Canceled"
    case "PARTIAL":
      return "Partial"
    default:
      return "Pending"
  }
}

export async function getSmmMarkupPercent(): Promise<number> {
  return getConfigNumber("SMM_MARKUP_PERCENT", Number(process.env.SMM_MARKUP_PERCENT) || 40)
}

/**
 * Calculates the user charge for an SMM order.
 * cost = rate * (quantity / 1000)
 * charge = cost * (1 + markup/100), rounded up to whole cents.
 */
export async function computeSmmCharge(rate: number, quantity: number): Promise<Prisma.Decimal> {
  const markup = await getSmmMarkupPercent()
  const cost = new Prisma.Decimal(rate).times(quantity).div(1000)
  return cost
    .times(1 + markup / 100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_UP)
}

/**
 * Calculates the base supplier cost for an SMM order (without markup).
 * cost = rate * (quantity / 1000), rounded up to whole cents.
 */
export async function computeSmmBaseCost(rate: number, quantity: number): Promise<Prisma.Decimal> {
  const cost = new Prisma.Decimal(rate).times(quantity).div(1000)
  return cost.toDecimalPlaces(2, Prisma.Decimal.ROUND_UP)
}

/**
 * Calculates the profit amount from an SMM order.
 * profit = charge - baseCost
 */
export async function computeSmmProfit(charge: Prisma.Decimal, rate: number, quantity: number): Promise<Prisma.Decimal> {
  const baseCost = await computeSmmBaseCost(rate, quantity)
  return charge.minus(baseCost).toDecimalPlaces(2, Prisma.Decimal.ROUND_UP)
}

/**
 * Atomically debits the wallet and creates the PENDING SmmOrder together
 * with its PURCHASE ledger entry. Throws INSUFFICIENT_BALANCE (402) without
 * touching anything if funds are low.
 */
export async function purchaseSmmOrder(
  userId: string,
  serviceId: string,
  serviceName: string,
  serviceCategory: string,
  targetLink: string,
  quantity: number,
  charge: Prisma.Decimal
) {
  return prisma.$transaction(async (tx) => {
    const debit = await tx.user.updateMany({
      where: { id: userId, walletBalance: { gte: charge } },
      data: { walletBalance: { decrement: charge } },
    })

    if (debit.count === 0) {
      throw new SmmOrderError(
        "INSUFFICIENT_BALANCE",
        "Insufficient wallet balance for this order. Please top up and try again.",
        402
      )
    }

    const order = await tx.smmOrder.create({
      data: {
        userId,
        serviceId,
        serviceName,
        serviceCategory,
        targetLink,
        quantity,
        price: charge,
        status: "PENDING",
      },
    })

    await tx.walletTransaction.create({
      data: {
        userId,
        amount: charge.negated(),
        type: "PURCHASE",
        status: "COMPLETED",
        reference: `smm-order-${order.id}`,
      },
    })

    return order
  })
}

/**
 * Persists the external order id returned by the provider. Called right
 * after a successful purchase + provider order creation.
 */
export async function linkSmmExternalOrder(orderId: string, externalOrderId: string) {
  await prisma.smmOrder.update({
    where: { id: orderId },
    data: { externalOrderId },
  })
}

/**
 * Records the profit from an SMM order as a SMM_PROFIT transaction.
 * This is called after a successful order is placed to extract the 40% profit.
 */
export async function recordSmmProfit(
  userId: string,
  orderId: string,
  profitAmount: Prisma.Decimal
): Promise<void> {
  await prisma.walletTransaction.create({
    data: {
      userId,
      amount: profitAmount,
      type: "SMM_PROFIT",
      status: "COMPLETED",
      reference: `smm-profit-${orderId}`,
    },
  })
}

/**
 * Syncs a single order's status from the provider and updates the local
 * record. Returns true when the status actually changed.
 */
export async function syncSmmOrderStatus(
  orderId: string,
  externalOrderId: string,
  providerStatus: SmmProviderStatus
): Promise<boolean> {
  const target = mapProviderStatusToEnum(providerStatus)

  return prisma.$transaction(async (tx) => {
    const current = await tx.smmOrder.findUnique({
      where: { id: orderId },
      select: { status: true },
    })
    if (!current) return false

    if (current.status === target) return false

    await tx.smmOrder.update({
      where: { id: orderId },
      data: { status: target },
    })

    return true
  })
}

/** Shapes an SmmOrder for API responses (Decimal → number). */
export function serializeSmmOrder(
  order: Pick<
    Prisma.SmmOrderGetPayload<object>,
    "id" | "status" | "price" | "serviceName" | "serviceCategory" | "serviceId" | "targetLink" | "quantity" | "externalOrderId" | "createdAt" | "updatedAt"
  >,
  extra?: { progress?: number; remains?: number }
) {
  const statusLabel: Record<SmmStatus, string> = {
    PENDING: "Pending",
    PROCESSING: "Processing",
    COMPLETED: "Completed",
    CANCELLED: "Canceled",
    PARTIAL: "Partial",
  }

  return {
    id: order.id,
    status: order.status,
    statusLabel: statusLabel[order.status] ?? order.status,
    serviceName: order.serviceName,
    serviceCategory: order.serviceCategory,
    serviceId: order.serviceId,
    targetLink: order.targetLink,
    quantity: order.quantity,
    price: order.price.toNumber(),
    externalOrderId: order.externalOrderId,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    ...extra,
  }
}

/** Maps an SmmProviderError to a JSON HTTP response; null when not one. */
export function smmProviderErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof SmmProviderError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.httpStatus }
    )
  }
  return null
}
