import { z } from "zod"

/**
 * Validation schemas for the SMS verification engine (Phase 3).
 *
 * country/service are validated as provider slugs rather than closed enums:
 * the catalog lists drive the UI, but the provider remains the source of
 * truth for what is actually available (unknown values surface as
 * "no stock" errors from the provider layer).
 */

const providerSlug = z
  .string()
  .min(2, "Value is too short")
  .max(32, "Value is too long")
  .regex(/^[a-z0-9_-]+$/, "Invalid provider code")

export const smsCatalogSchema = z.object({
  country: providerSlug,
})

export const smsOrderSchema = z.object({
  country: providerSlug,
  service: providerSlug,
})

export const smsCancelSchema = z.object({
  orderId: z.string().min(1, "Order id is required").max(64),
  /** "user" = cancelled from the UI, "timeout" = countdown ran out. */
  reason: z.enum(["user", "timeout"]).default("user"),
})

export const smsOrderIdQuerySchema = z.object({
  orderId: z.string().min(1, "Order id is required").max(64),
})

export type SmsOrderInput = z.infer<typeof smsOrderSchema>
export type SmsCancelInput = z.infer<typeof smsCancelSchema>
