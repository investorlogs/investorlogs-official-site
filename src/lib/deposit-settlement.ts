/**
 * Pure settlement rules for gateway-confirmed wallet deposits.
 *
 * This module deliberately imports neither Prisma nor `process.env`, so every
 * rule below is unit-testable without a database (see the sibling .test.ts).
 * The database-facing half lives in settleDeposit.ts.
 *
 * Why this is shared rather than duplicated per route:
 *
 *   A webhook and a post-checkout callback are two independent ways the SAME
 *   payment can arrive, and they must agree exactly. An earlier callback
 *   marked a deposit COMPLETED without asking the gateway and without
 *   incrementing the balance. That was doubly broken — the customer paid and
 *   received nothing, and because the row was no longer PENDING the real
 *   webhook then treated it as already-settled and skipped it too, so the
 *   money was never recoverable by either path.
 *
 *   Both routes now funnel through these rules, so the two paths cannot drift
 *   apart again.
 */

/** Gateway-reported outcome, normalised across Paystack's several spellings. */
export type ProviderStatus = "success" | "failed" | "pending"

export type SettleOutcome =
  /** Gateway verified a real payment; the wallet was incremented. */
  | "credited"
  /** Gateway confirmed a failure; the deposit is now FAILED. */
  | "marked_failed"
  /** Gateway has not settled the payment yet; nothing was written. */
  | "still_pending"
  /** Already terminal (COMPLETED/FAILED/CANCELLED); idempotent no-op. */
  | "already_settled"
  /**
   * The gateway amount disagreed with the amount we recorded. Deliberately
   * NOT credited: crediting a mismatched amount is how a wallet ends up
   * wrong in a way that is very hard to unwind after the fact.
   */
  | "amount_mismatch"
  /** No WalletTransaction carries this reference. */
  | "unknown_reference"
  /** The reference belongs to a non-DEPOSIT row (purchase, refund, profit). */
  | "not_a_deposit"

/**
 * Paystack references are ~30 characters. This is a generous ceiling that
 * exists so an attacker cannot push an arbitrary-length string into the
 * verify URL.
 */
export const MAX_REFERENCE_LENGTH = 128

const SUCCESS_WORDS = new Set([
  "success",
  "successful",
  "succeeded",
  "complete",
  "completed",
])

const FAILED_WORDS = new Set([
  "fail",
  "failed",
  "failure",
  "abandoned",
  "cancelled",
  "canceled",
  "reversed",
])

/**
 * Normalises a gateway status string.
 *
 * Paystack is not consistent here: the `charge.success` webhook carries
 * "success" while some verify responses and the hosted checkout say
 * "successful". Matching on only one of them silently drops real payments on
 * the floor, so every spelling is accepted.
 *
 * Anything unrecognised is treated as "pending" — never as "success". The
 * previous implementation defaulted an ABSENT status to "success", which meant
 * a malformed webhook could credit a wallet for a payment that never happened.
 */
export function normalizeProviderStatus(raw: unknown): ProviderStatus {
  if (typeof raw !== "string") return "pending"
  const value = raw.trim().toLowerCase()
  if (SUCCESS_WORDS.has(value)) return "success"
  if (FAILED_WORDS.has(value)) return "failed"
  return "pending"
}

/** Converts kobo (Paystack's minor unit) to naira, or null if unusable. */
export function koboToNaira(kobo: unknown): number | null {
  const value = typeof kobo === "string" ? Number(kobo) : kobo
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null
  }
  return Math.round(value) / 100
}

function toCents(amount: number): number {
  return Math.round(amount * 100)
}

/** Compares two NGN amounts without floating-point drift. */
export function amountsMatch(expected: number, paid: number): boolean {
  return toCents(expected) === toCents(paid)
}

/**
 * Whether a gateway-reported amount is meaningful enough to enforce.
 *
 * Some provider events omit the amount. A missing amount must not be treated
 * as a mismatch (which would block every legitimate payment), but a present
 * amount that disagrees must block crediting.
 */
export function shouldEnforceAmount(paid: number | null): paid is number {
  return paid !== null && Number.isFinite(paid) && toCents(paid) > 0
}

/** Shape guard for a reference pulled out of an untrusted query string. */
export function isPlausibleReference(reference: unknown): reference is string {
  return (
    typeof reference === "string" &&
    reference.length > 0 &&
    reference.length <= MAX_REFERENCE_LENGTH
  )
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined
}

/**
 * Pulls the reference out of a webhook envelope. Paystack nests it at
 * `data.reference`; the mock provider and some verify responses put it at the
 * top level.
 */
export function extractReference(payload: unknown): string | null {
  const record = asRecord(payload)
  if (!record) return null
  const data = asRecord(record.data)
  const candidate = data?.reference ?? record.reference
  return isPlausibleReference(candidate) ? candidate : null
}

/** Pulls the paid amount (in naira) out of a webhook envelope. */
export function extractGatewayAmount(payload: unknown): number | null {
  const record = asRecord(payload)
  if (!record) return null
  const data = asRecord(record.data)
  return koboToNaira(data?.amount ?? record.amount)
}

/** Pulls the normalised status out of a webhook envelope. */
export function extractGatewayStatus(payload: unknown): ProviderStatus {
  const record = asRecord(payload)
  if (!record) return "pending"
  const data = asRecord(record.data)
  return normalizeProviderStatus(data?.status ?? record.status)
}
