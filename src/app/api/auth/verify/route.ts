import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { hashResetToken } from "@/lib/email"

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, code } = verifySchema.parse(body)

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true },
    })
    if (!user) {
      return NextResponse.json({ error: "Invalid email or code" }, { status: 400 })
    }
    if (user.emailVerified) {
      return NextResponse.json({ message: "Email already verified" })
    }

    const record = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashResetToken(code) },
    })
    if (!record || record.userId !== user.id) {
      return NextResponse.json({ error: "Invalid email or code" }, { status: 400 })
    }
    if (record.expiresAt < new Date()) {
      await prisma.emailVerificationToken.delete({ where: { id: record.id } })
      return NextResponse.json(
        { error: "Code expired. Request a new one." },
        { status: 400 }
      )
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      }),
      prisma.emailVerificationToken.delete({ where: { id: record.id } }),
    ])

    return NextResponse.json({ message: "Email verified. You can now sign in." })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }
    console.error("[verify] error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
