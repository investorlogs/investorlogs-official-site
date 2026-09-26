import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { apiSignupSchema } from "@/lib/validations/auth"
import {
  generateVerificationCode,
  hashResetToken,
  buildVerificationEmail,
  sendEmail,
} from "@/lib/email"
import { z } from "zod"

// Verification codes expire 15 minutes after creation.
const VERIFY_EXPIRES_MS = 15 * 60 * 1000

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = apiSignupSchema.parse(body)
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    })
    
    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      )
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 12)
    
    // Create user (unverified until the emailed code is confirmed)
    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        role: "USER",
        walletBalance: 0,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        walletBalance: true,
        createdAt: true,
      },
    })

    // Issue a 6-digit code, store only its hash, email the plain code.
    // Signup never fails when email is unconfigured — the code is still
    // created so /auth/verify can succeed in dev via server logs.
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
    const emailResult = await sendEmail({ to: user.email, subject, html, text })
    if (!emailResult.ok) {
      console.error("[signup] Verification email failed:", emailResult.error)
    } else if (process.env.NODE_ENV !== "production") {
      console.log("[signup] Verification code for", user.email, ":", code)
    }

    return NextResponse.json(
      {
        message: "User created successfully. Check your email for a verification code.",
        user,
        verificationRequired: true,
      },
      { status: 201 }
    )
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }
    
    console.error("Signup error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}