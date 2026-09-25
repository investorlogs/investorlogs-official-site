import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { PaymentProviderError, verifyPaystackPayment } from "@/lib/paymentProvider"
import { isPlausibleReference } from "@/lib/deposit-settlement"
import { settleDeposit } from "@/lib/settleDeposit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const WALLET_PATH = "/dashboard/wallet"

/** The callback is a browser redirect, so it lands on the real wallet route. */
function walletUrl(request: NextRequest, result?: string): URL {
  const base = (process.env.NEXTAUTH_URL ?? request.nextUrl.origin).replace(/\/+$/, "")
  const url = new URL(WALLET_PATH, base)
  if (result) url.searchParams.set("deposit", result)
  return url
}

/**
 * Post-checkout callback for Paystack (the non-webhook confirmation path).
 *
 * This URL is attacker-controllable: a customer can edit the `reference` in
 * their own address bar, or simply visit it with a reference they did not pay
 * for. So the reference is NEVER trusted to mean "the money arrived" here.
 * Instead the gateway is asked to verify the transaction, and only then does
 * the shared settleDeposit() credit the wallet.
 *
 * The previous version of this route did neither. It flipped the deposit to
 * COMPLETED straight from the query string and never touched walletBalance —
 * so the customer was charged and credited nothing, and because the row was no
 * longer PENDING the genuine webhook later skipped it as already-settled. That
 * is precisely the "customer pays without being credited" failure that
 * PAYMENTS_ENABLED was left off to prevent.
 */
export async function GET(request: NextRequest) {
  const session = await getSession()

  if (!session?.user?.id) {
    return NextResponse.redirect(
      new URL(
        `/auth/login?callbackUrl=${encodeURIComponent(WALLET_PATH)}`,
        (process.env.NEXTAUTH_URL ?? request.nextUrl.origin).replace(/\/+$/, "")
      )
    )
  }

  const raw =
    request.nextUrl.searchParams.get("reference") ??
    request.nextUrl.searchParams.get("ref")

  if (!isPlausibleReference(raw)) {
    return NextResponse.redirect(walletUrl(request))
  }

  const reference = raw

  // Ownership check: a signed-in user must not be able to drive another
  // account's deposit to a terminal state by guessing its reference.
  const existing = await prisma.walletTransaction.findUnique({
    where: { reference },
    select: { userId: true },
  })

  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.redirect(walletUrl(request))
  }

  let providerStatus: "success" | "failed" | "pending"
  let paidAmount: number | null

  try {
    const verification = await verifyPaystackPayment(reference)
    // Guard against a gateway echoing back a different reference than we asked
    // about; settle the reference we actually resolved ownership of.
    if (verification.reference !== reference) {
      return NextResponse.redirect(walletUrl(request))
    }
    providerStatus = verification.status
    paidAmount = verification.amount
  } catch (error) {
    // The wallet is the source of truth here, not the gateway. If verification
    // is unreachable we must NOT guess: leave the deposit PENDING so the
    // webhook can still settle it, and tell the customer it is confirming.
    console.error(`[payments/callback] verification failed for ${reference}:`, error)
    return NextResponse.redirect(walletUrl(request, "pending"))
  }

  const result = await settleDeposit({ reference, providerStatus, paidAmount })

  if (result.outcome === "credited" || result.outcome === "already_settled") {
    return NextResponse.redirect(walletUrl(request, "success"))
  }

  if (result.outcome === "marked_failed") {
    return NextResponse.redirect(walletUrl(request, "failed"))
  }

  if (result.outcome === "amount_mismatch") {
    console.error(
      `[payments/callback] Amount mismatch on ${reference}; not crediting. ` +
        `Support must reconcile this deposit.`
    )
    return NextResponse.redirect(walletUrl(request, "pending"))
  }

  return NextResponse.redirect(walletUrl(request, "pending"))
}

export { PaymentProviderError }
export { GET as POST }
