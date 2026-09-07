import { z } from "zod"

/**
 * Validation schemas for authentication
 */

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required")
})

// Base schema without refinements — lets the API omit confirmPassword safely (Zod 4
// forbids .omit() on schemas carrying refinements).
const signupBaseSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name must be less than 50 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string()
})

// Client-side form schema: cross-field password match check
export const signupSchema = signupBaseSchema.refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
})

// Server-side API schema: confirmPassword is optional client-side state, not validated here
export const apiSignupSchema = signupBaseSchema.omit({ confirmPassword: true })

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>