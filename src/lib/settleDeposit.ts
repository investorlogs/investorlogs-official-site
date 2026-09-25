import { prisma } from "@/lib/prisma"
import {
  amountsMatch,
  shouldEnforceAmount,
  type ProviderStatus,
  type SettleOutcome,
} from "@/lib/deposit-settlement"

export interface SettleDepositInput {
  reference: string
  /** Normalised gateway status. */
  providerStatus: ProviderStatus
  /**
   * Amount the gateway says was actually paid, in NGN. Pass null/undefined
   * when the gateway did not report one; a reported amount that disagrees with
   * the stored amount blocks crediting.
   */
  paidAmount?: number | null
}

export interface SettleDepositResult {
  outcome: SettleOutcome
  /** The owning user, when the reference resolved to a real transaction. */
  userId?: string
  /** The stored transaction amount, in NGN. */
  amount?: number
}

/**
 * Settles a wallet deposit against a gateway-confirmed status.
 *
 * This is the single place a DEPOSIT is ever turned into (or kept from
 * becoming) real wallet balance. Both the webhook and the post-checkout
 * callback call it, which is what guarantees the two cannot disagree.
 *
 * Idempotency is enforced by the database, not by a read-then-write check: the
 * update is a compare-and-swap on `status: "PENDING"`. A webhook and a
 * callback racing for the same reference means one of them updates zero rows
 * and returns `already_settled` without crediting. A prior implementation
 * read the row first, which left a window in which both paths could credit.
 */
export async function settleDeposit(
  input: SettleDepositInput
): Promise<SettleDepositResult> {
  const { reference, providerStatus } = input
  const paidAmount = input.paidAmount ?? null

  const existing = await prisma.walletTransaction.findUnique({
    where: { reference },
  })

  if (!existing) {
    return { outcome: "unknown_reference" }
  }

  // Only deposits create balance. A PURCHASE/REFUND/PROFIT row sharing this
  // reference must never be "settled" into a credit.
  if (existing.type !== "DEPOSIT") {
    return { outcome: "not_a_deposit", userId: existing.userId, amount: existing.amount.toNumber() }
  }

  const amount = existing.amount.toDecimalPlaces(2)

  if (providerStatus === "pending") {
    // Nothing is settled yet. Leave the row PENDING so a later webhook or
    // callback can still complete it.
    return { outcome: "still_pending", userId: existing.userId, amount: amount.toNumber() }
  }

  // A gateway amount that is present and disagrees with ours is a real
  // discrepancy. Refuse to credit and leave the row PENDING so support can
  // reconcile it — better a visibly-stuck deposit than a wrong balance.
  if (shouldEnforceAmount(paidAmount) && !amountsMatch(amount.toNumber(), paidAmount)) {
    console.error(
      `[settleDeposit] Amount mismatch for ${reference}: expected ${amount.toFixed(2)} NGN, ` +
        `gateway reported ${paidAmount.toFixed(2)} NGN. Not crediting.`
    )
    return { outcome: "amount_mismatch", userId: existing.userId, amount: amount.toNumber() }
  }

  const nextStatus = providerStatus === "success" ? "COMPLETED" : "FAILED"

  const credited = await prisma.$transaction(async (tx) => {
    // Compare-and-swap: only a still-PENDING deposit can transition, so a
    // duplicate webhook (Paystack retries) or a callback arriving alongside
    // the webhook credits exactly once.
    const claimed = await tx.walletTransaction.updateMany({
      where: { id: existing.id, type: "DEPOSIT", status: "PENDING" },
      data: { status: nextStatus },
    })

    if (claimed.count === 0) return false

    if (nextStatus === "COMPLETED") {
      await tx.user.update({
        where: { id: existing.userId },
        data: { walletBalance: { increment: amount } },
      })
    }

    return true
  })

  if (!credited) {
    return { outcome: "already_settled", userId: existing.userId, amount: amount.toNumber() }
  }

  return {
    outcome: providerStatus === "success" ? "credited" : "marked_failed",
    userId: existing.userId,
    amount: amount.toNumber(),
  }
}
