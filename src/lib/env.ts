import { z } from "zod"

/**
 * Typed environment configuration (Phase 5).
 *
 * The app reads dozens of process.env keys across payments, SMS, SMM, email,
 * and auth. Without a single schema, a missing DATABASE_URL or NEXTAUTH_SECRET
 * surfaces as a confusing crash deep inside a request instead of at startup.
 *
 * Required keys throw when absent. Everything else is optional and simply
 * arrives as `undefined`, so a partially configured deployment still boots and
 * degrades gracefully (the mobile/email/assistant features already handle
 * "not configured" paths).
 *
 * Keep this in sync with .env.example — that file documents the same keys.
 */

/** Placeholder shapes shipped in .env.example. A value matching one of these
 *  means the operator never replaced the sample, which is worse than blank. */
const PLACEHOLDER_PREFIXES = ["sk_test_xxx", "re_xxx", "your-"]

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_PREFIXES.some((prefix) => value.startsWith(prefix))
}

/** A required string that must be present and not a leftover sample value. */
const requiredString = (name: string) =>
  z
    .string({ error: `${name} is required` })
    .min(1, `${name} must not be empty`)
    .refine((value) => !isPlaceholder(value), {
      error: `${name} still holds the .env.example placeholder — set a real value`,
    })

/** An optional string; blank strings are normalized to undefined. */
const optionalString = () =>
  z
    .string()
    .transform((value) => (value.trim() === "" ? undefined : value))
    .optional()

/** An optional boolean flag. Only the literal "true" enables it, matching how
 *  isPaymentMock() / isMockProvider() / isSmmMockProvider() read these vars. */
const optionalFlag = () =>
  z
    .string()
    .optional()
    .transform((value) => value === "true")

export const envSchema = z.object({
  // --- Required ---------------------------------------------------------
  DATABASE_URL: requiredString("DATABASE_URL"),
  NEXTAUTH_SECRET: requiredString("NEXTAUTH_SECRET"),
  NEXTAUTH_URL: requiredString("NEXTAUTH_URL"),

  // --- Optional: providers ----------------------------------------------
  XCLUSIVE_PLUGS_API_URL: optionalString(),
  XCLUSIVE_PLUGS_API_KEY: optionalString(),
  XCLUSIVE_PLUGS_DEBUG: optionalFlag(),

  SMS_PROVIDER_BASE_URL: optionalString(),
  SMS_PROVIDER_API_KEY: optionalString(),
  SMS_PROVIDER_MOCK: optionalFlag(),

  SMM_PROVIDER_BASE_URL: optionalString(),
  SMM_PROVIDER_API_KEY: optionalString(),
  SMM_PROVIDER_MOCK: optionalFlag(),
  SMM_MARKUP_PERCENT: z.coerce.number().nonnegative().optional(),

  // --- Optional: payments -----------------------------------------------
  PAYMENTS_ENABLED: optionalFlag(),
  PAYSTACK_BASE_URL: optionalString(),
  PAYSTACK_SECRET_KEY: optionalString(),
  PAYSTACK_WEBHOOK_SECRET: optionalString(),
  PAYMENT_PROVIDER_MOCK: optionalFlag(),

  // --- Optional: notifications and support ------------------------------
  RESEND_API_KEY: optionalString(),
  RESEND_FROM_EMAIL: optionalString(),
  OPENAI_API_KEY: optionalString(),

  // --- Optional: cron ---------------------------------------------------
  CRON_SECRET: optionalString(),
})

export type Env = z.infer<typeof envSchema>

/** Formats zod issues into a readable, multi-line startup error. */
function formatIssues(issues: z.core.$ZodIssue[]): string {
  return issues.map((issue) => `  - ${issue.path.join(".") || "env"}: ${issue.message}`).join("\n")
}

/**
 * Validates the provided environment (defaults to process.env).
 *
 * Throws an Error listing every problem at once, so a misconfigured deploy
 * reports all missing keys in a single run instead of one per retry.
 *
 * Exported separately from the cached `env` object so it can be exercised in
 * tests with synthetic inputs without mutating process.env.
 */
export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source)

  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${formatIssues(result.error.issues)}\n\n` +
        "Copy .env.example to .env and fill in the required values."
    )
  }

  return result.data
}

/**
 * The validated environment, parsed once on first access and then cached.
 *
 * Kept lazy rather than computed at import time so that importing this module
 * (for parseEnv, the schema, or the Env type) never throws on its own — tests
 * and tooling can import it without a populated process.env. The first real
 * read still asserts the required keys, so a misconfigured deploy fails on the
 * first request that touches config instead of silently running degraded.
 */
let cachedEnv: Env | undefined

export function getEnv(): Env {
  cachedEnv ??= parseEnv()
  return cachedEnv
}