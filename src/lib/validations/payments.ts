import { z } from "zod"

export const paymentMethodSchema = z.enum(["card_paystack", "crypto"])

export const paymentInitializeSchema = z.object({
  amount: z
    .number()
    .min(1, "Amount must be a positive number")
    .max(5000000, "Amount exceeds maximum deposit (₦5,000,000)"),
  method: paymentMethodSchema,
})

export type PaymentInitializeInput = z.infer<typeof paymentInitializeSchema>

export const paymentReferenceSchema = z.object({
  ref: z.string().min(1).max(128),
})
