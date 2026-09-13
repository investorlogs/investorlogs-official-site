import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"

/**
 * Fallback callback URL for Paystack (non-webhook confirmation).
 * Redirects to the wallet page after a brief sync of the transaction.
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL ?? ""}/login?callbackUrl=/wallet`)
  }

  const reference = request.nextUrl.searchParams.get("reference") ?? request.nextUrl.searchParams.get("ref")

  if (reference) {
    const tx = await prisma.walletTransaction.findUnique({
      where: { reference },
    })
    if (tx) {
      await prisma.walletTransaction.update({
        where: { reference },
        data: { status: "COMPLETED" },
      })
    }
  }

  return NextResponse.redirect(`${process.env.NEXTAUTH_URL ?? ""}/wallet`)
}

export { GET as POST }
