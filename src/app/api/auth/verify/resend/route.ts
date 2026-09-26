import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import {
  generateVerificationCode,
  hashResetToken,
  buildVerificationEmail,
  sendEmail,
} from "@/lib/email"

const resendSchema = z.object({ email: z.string().email() })

const VERIFY_EXPIRES_MS = 15 * 60 * 1000

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = resendSchema.parse(body)

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, emailVerified: true },
    })
    // Always return success to avoid user enumeration.
    if (user && !user.emailVerified) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } })
      const code = generateVerificationCode()
      await prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: hashResetToken(code),
          expiresAt: new Date(Date.now() + VERIFY_EXPIRES_MS),
        },
      })
      const { subject, html, text } = buildVerificationEmail({
        name: user.name ?? "there",
        code,
      })
      const result = await sendEmail({ to: user.email, subject, html, text })
      if (!result.ok) {
        console.error("[resend] Verification email failed:", result.error)
      } else if (process.env.NODE_ENV !== "production") {
        console.log("[resend] Verification code for", user.email, ":", code)
      }
    }

    return NextResponse.json({
      message: "If that email needs verification, a new code is on its way.",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }
    console.error("[resend] error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
