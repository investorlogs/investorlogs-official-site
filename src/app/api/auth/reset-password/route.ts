import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/auth"
import { hashResetToken } from "@/lib/email"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password }: ResetPasswordInput = resetPasswordSchema.parse(body)

    const tokenHash = hashResetToken(token)
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: tokenHash },
      include: { user: { select: { id: true, email: true } } },
    })

    if (!resetToken) {
      return NextResponse.json(
        { error: "Invalid or expired reset link. Please request a new one.", code: "INVALID_TOKEN" },
        { status: 400 }
      )
    }

    if (resetToken.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({ where: { id: resetToken.id } })
      return NextResponse.json(
        { error: "This reset link has expired. Please request a new one.", code: "TOKEN_EXPIRED" },
        { status: 400 }
      )
    }

    if (resetToken.usedAt) {
      return NextResponse.json(
        { error: "This reset link has already been used.", code: "TOKEN_USED" },
        { status: 400 }
      )
    }

    // Hash the new password and mark the token as used — atomic transaction.
    const hashedPassword = await bcrypt.hash(password, 12)
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ])

    return NextResponse.json({
      message: "Your password has been reset. You can now sign in.",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 })
    }
    console.error("Reset password error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export { resetPasswordSchema, type ResetPasswordInput }