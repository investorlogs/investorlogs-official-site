import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { getSession } from "@/lib/session"
import {
  PaymentProviderError,
  initializePayment,
  isPaymentProviderConfigured,
  paymentsEnabled,
} from "@/lib/paymentProvider"
import { FlutterwaveProviderError } from "@/lib/flutterwave"
import { paymentInitializeSchema } from "@/lib/validations/payments"

export const dynamic = "force-dynamic"

/**
 * Initializes a wallet deposit. Creates a PENDING DEPOSIT WalletTransaction
 * with a unique reference, then creates the payment session on the provider.
 * The transaction is only credited after the webhook confirms the payment.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Deposits are gated behind PAYMENTS_ENABLED until the full flow (gateway
    // verification + wallet crediting) is live. Refusing here means a customer
    // can never reach a checkout that would take money we cannot credit.
    if (!paymentsEnabled()) {
      return NextResponse.json(
        {
          error: "Deposits are not available yet. Please check back soon.",
          code: "DEPOSITS_DISABLED",
        },
        { status: 503 }
      )
    }

    const userId = session.user.id
    const email = session.user.email ?? ""
    const { amount, method } = paymentInitializeSchema.parse(await request.json())

    if (!isPaymentProviderConfigured()) {
      return NextResponse.json(
        { error: "No payment provider is configured.", code: "NOT_CONFIGURED" },
        { status: 503 }
      )
    }

    // Verify the user exists in the database before creating a deposit.
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })
    if (!existingUser) {
      return NextResponse.json(
        { error: "User account not found. Please log in again.", code: "USER_NOT_FOUND" },
        { status: 401 }
      )
    }

    const charge = new Prisma.Decimal(amount).toDecimalPlaces(2)

    // 1. Create the DEPOSIT record first (idempotency anchor).
    const referencePrefix = method === "crypto" ? "crypto" : method === "transfer_flutterwave" ? "transfer" : "card"
    const reference = `${referencePrefix}-${userId}-${Date.now()}`
    let tx
    try {
      tx = await prisma.walletTransaction.create({
        data: {
          userId,
          amount: charge,
          type: "DEPOSIT",
          status: "PENDING",
          reference,
        },
      })
    } catch (createError) {
      console.error("Wallet transaction create error:", createError)
      return NextResponse.json(
        { error: "Could not create deposit record. Please try again.", code: "DEPOSIT_CREATE_FAILED" },
        { status: 500 }
      )
    }

    // 2. Create the payment session on the provider.
    try {
      const result = await initializePayment(userId, email, Number(charge), method)
      await prisma.walletTransaction.update({
        where: { id: tx.id },
        data: { reference: result.reference },
      })

      return NextResponse.json({
        reference: result.reference,
        authorizationUrl: result.authorizationUrl,
        qrCode: result.qrCode,
        provider: result.provider,
        amount: Number(charge),
      })
    } catch (error) {
      // Roll back: delete the deposit record so the reference is reusable.
      await prisma.walletTransaction.delete({ where: { id: tx.id } })

      const providerResponse = isPaymentProviderError(error)
      if (providerResponse) return providerResponse

      console.error("Payment initialization error:", error)
      return NextResponse.json(
        { error: "Could not initialize payment. Please try again." },
        { status: 502 }
      )
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }
    if (
      error instanceof PaymentProviderError ||
      error instanceof FlutterwaveProviderError
    ) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.httpStatus }
      )
    }

    console.error("Payment initialize error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function isPaymentProviderError(error: unknown): NextResponse | null {
  if (error instanceof PaymentProviderError || error instanceof FlutterwaveProviderError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.httpStatus }
    )
  }
  return null
}
