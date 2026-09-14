import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { Prisma } from "@/generated/prisma/client"

const mockConfirmSchema = z.object({
  reference: z.string().min(1),
})

/**
 * Mock payment confirmation endpoint (development/mock mode only).
 *
 * In mock mode there is no real payment gateway to redirect back to, so the
 * mock checkout page posts the DEPOSIT reference here. This endpoint:
 *   1. Authenticates the user.
 *   2. Finds the pending DEPOSIT by reference.
 *   3. Credits the user's wallet (increment walletBalance).
 *   4. Marks the transaction COMPLETED.
 *
 * For real providers (Paystack/Webhook), the webhook route handles this via
 * HMAC verification instead.
 */
export async function POST(request: NextRequest) {
  // The mock provider only exists so local development works without a
  // gateway. In production it must be dead: this endpoint credits a wallet on
  // request, so leaving it reachable would hand out free balance.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { reference } = mockConfirmSchema.parse(await request.json())
    const userId = session.user.id

    const tx = await prisma.walletTransaction.findUnique({
      where: { reference },
    })

    if (!tx) {
      return NextResponse.json({ error: "Unknown reference" }, { status: 404 })
    }

    if (tx.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    if (tx.type !== "DEPOSIT") {
      return NextResponse.json(
        { error: "Reference is not a deposit transaction", code: "BAD_REFERENCE" },
        { status: 400 }
      )
    }

    if (tx.status !== "PENDING") {
      return NextResponse.json(
        { error: "Transaction already processed", code: "ALREADY_PROCESSED" },
        { status: 409 }
      )
    }

    await prisma.$transaction([
      prisma.walletTransaction.update({
        where: { id: tx.id },
        data: { status: "COMPLETED" },
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          walletBalance: {
            increment: new Prisma.Decimal(tx.amount).toDecimalPlaces(2),
          },
        },
      }),
    ])

    return NextResponse.json({ success: true, reference, status: "COMPLETED" })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }
    console.error("Mock confirm error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
