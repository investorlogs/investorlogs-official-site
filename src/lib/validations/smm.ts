import { z } from "zod"

/**
 * Validation schemas for the SMM boosting engine (Phase 4).
 *
 * serviceId is validated as a provider slug (string); the catalog lists drive
 * the UI, but the provider remains the source of truth for what is actually
 * available (unknown values surface as errors from the provider layer).
 */

const serviceIdSchema = z
  .string()
  .min(1, "Service id is required")
  .max(64, "Service id is too long")
  .regex(/^[a-z0-9_-]+$/, "Invalid service id")

export const smmCatalogSchema = z.object({
  platform: z
    .string()
    .min(2, "Platform is too short")
    .max(32, "Platform is too long")
    .regex(/^[a-z]+$/, "Invalid platform code")
    .optional(),
})

export const smmOrderSchema = z.object({
  serviceId: serviceIdSchema,
  targetLink: z
    .string()
    .min(1, "Target link or username is required")
    .max(500, "Target link is too long"),
  quantity: z
    .number()
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1"),
  total: z
    .number()
    .nonnegative("Total price is required")
    .optional(),
})

export const smmOrderIdQuerySchema = z.object({
  orderId: z.string().min(1, "Order id is required").max(64),
})

export type SmmOrderInput = z.infer<typeof smmOrderSchema>
