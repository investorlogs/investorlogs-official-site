/**
 * Production safety guard (Phase 5).
 *
 * The mock providers exist so local development works without real gateway
 * credentials. Every one of them is dangerous in production:
 *
 *   - PAYMENT_PROVIDER_MOCK lets a deposit settle with no gateway charge, so a
 *     customer could credit their own wallet for free.
 *   - SMS_PROVIDER_MOCK / SMM_PROVIDER_MOCK hand out numbers and boosting
 *     orders the supplier never received, while the wallet is debited.
 *
 * A deploy that sets any of these to "true" is a wallet-draining bug, not a
 * configuration preference. This module is imported by the provider helpers so
 * it runs on the first request that touches payments/SMS/SMM, and the process
 * throws instead of serving traffic.
 *
 * Only the literal string "true" counts as enabled — that matches how
 * isPaymentMock() / isMockProvider() / isSmmMockProvider() read the flags, so
 * "1", "yes", and "TRUE" are all treated as unset by both.
 */

const MOCK_FLAGS = [
  "PAYMENT_PROVIDER_MOCK",
  "SMS_PROVIDER_MOCK",
  "SMM_PROVIDER_MOCK",
] as const

/**
 * Throws when NODE_ENV=production and any *_MOCK flag is "true".
 *
 * Safe to call repeatedly — it only inspects process.env and holds no state.
 */
export function assertNoMockProvidersInProduction(): void {
  if (process.env.NODE_ENV !== "production") return

  const enabled = MOCK_FLAGS.filter((flag) => process.env[flag] === "true")

  if (enabled.length === 0) return

  throw new Error(
    `Refusing to start: ${enabled.join(", ")} ${
      enabled.length === 1 ? "is" : "are"
    } set to "true" while NODE_ENV=production. ` +
      "Mock providers settle payments and supplier orders without contacting a " +
      "real gateway, which would let customers credit their own wallets. " +
      "Unset these variables (or set them to \"false\") in your production environment."
  )
}