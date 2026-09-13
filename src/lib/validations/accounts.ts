import { z } from "zod"

/**
 * Validation schemas for the digital accounts storefront (Phase 2)
 */

export const purchaseSchema = z.object({
  accountCategoryId: z.string().min(1, "Account category is required"),
  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1")
    .max(50, "Quantity cannot exceed 50 per order"),
})

export const adminAccountUploadSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  price: z.coerce
    .number()
    .positive("Price must be greater than 0")
    .max(99_999_999, "Price is too large"),
  titlePrefix: z
    .string()
    .trim()
    .min(1, "Title prefix must not be empty")
    .max(100, "Title prefix must be less than 100 characters")
    .optional(),
  credentialsText: z
    .string()
    .min(1, "Credentials text is required")
    .max(1_000_000, "Credentials text is too large (max 1MB)"),
})

export type PurchaseInput = z.infer<typeof purchaseSchema>
export type AdminAccountUploadInput = z.infer<typeof adminAccountUploadSchema>
