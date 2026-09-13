import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Returns the authenticated user's wallet transactions (latest first).
 * Used by the wallet dashboard to show deposit/purchase/refund history.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id
    const limit = Math.min(
      Number(request.nextUrl.searchParams.get("limit") ?? "50"),
      100
    )

    const [transactions, user] = await prisma.$transaction([
      prisma.walletTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { walletBalance: true },
      }),
    ])

    return NextResponse.json({
      walletBalance: user?.walletBalance.toNumber() ?? 0,
      transactions: transactions.map((tx) => ({
        id: tx.id,
        amount: tx.amount.toNumber(),
        type: tx.type,
        status: tx.status,
        reference: tx.reference,
        createdAt: tx.createdAt.toISOString(),
        updatedAt: tx.updatedAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error("Payment status error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
