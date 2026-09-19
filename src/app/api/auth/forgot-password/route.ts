import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth"
import {
  generateResetToken,
  hashResetToken,
  buildResetLink,
  buildPasswordResetEmail,
  sendEmail,
} from "@/lib/email"

// Tokens expire 1 hour after creation.
const RESET_TOKEN_EXPIRES_MS = 60 * 60 * 1000

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email }: ForgotPasswordInput = forgotPasswordSchema.parse(body)

    // Always return success to avoid user enumeration.
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    })

    if (user) {
      // Delete any existing tokens for this user so only the latest is valid.
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })

      const rawToken = generateResetToken()
      const tokenHash = hashResetToken(rawToken)
      const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRES_MS)

      await prisma.passwordResetToken.create({
        data: { userId: user.id, token: tokenHash, expiresAt },
      })

      const resetLink = buildResetLink(rawToken)
      const { subject, html, text } = buildPasswordResetEmail({
        name: user.name ?? "there",
        resetLink,
        expiresAt,
      })

      const result = await sendEmail({ to: user.email, subject, html, text })
      if (!result.ok) {
        // Don't leak the failure to the caller, but log it.
        console.error("[forgot-password] Email send failed:", result.error)
      } else if (process.env.NODE_ENV !== "production") {
        console.log("[forgot-password] Reset link for", user.email, ":", resetLink)
      }
    }

    return NextResponse.json({
      message: "If an account with that email exists, we have sent a reset link.",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 })
    }
    console.error("Forgot password error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Re-export schema for client-side type inference.
export { forgotPasswordSchema, type ForgotPasswordInput }