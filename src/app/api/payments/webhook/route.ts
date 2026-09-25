import { NextRequest, NextResponse } from "next/server"
import { mockWebhookSignature, verifyWebhookSignature } from "@/lib/paymentProvider"
import {
  extractGatewayAmount,
  extractGatewayStatus,
  extractReference,
} from "@/lib/deposit-settlement"
import { settleDeposit } from "@/lib/settleDeposit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Receives payment confirmation webhooks.
 *
 * - Paystack sends `x-paystack-signature` (HMAC-SHA512 of raw body).
 * - Mock provider (tests) sends `x-mock-signature` (HMAC-SHA256 of raw body,
 *   signed with `MOCK_WEBHOOK_SECRET`).
 *
 * Once verified, the corresponding WalletTransaction DEPOSIT is updated to
 * COMPLETED or FAILED based on the provider's "status" field.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-paystack-signature") ?? ""
  const mockSignature = request.headers.get("x-mock-signature") ?? ""

  // The mock provider is a local/test affordance only. In production only the
  // real gateway (Paystack) may settle a deposit.
  const mockAllowed = process.env.NODE_ENV !== "production"

  const provider: "mock" | "paystack" | null = mockSignature
    ? mockAllowed
      ? "mock"
      : null
    : signature
      ? "paystack"
      : null
  if (mockSignature && !mockAllowed) {
    return NextResponse.json({ error: "Mock webhooks are disabled" }, { status: 403 })
  }

  if (!provider) {
    return NextResponse.json({ error: "Missing signature header" }, { status: 401 })
  }

  const rawBody = await request.text()
  const sig = provider === "mock" ? mockSignature : signature

  if (!verifyWebhookSignature(rawBody, sig, provider)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let payload: Record<string | number, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string | number, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const reference = extractReference(payload)

  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 })
  }

  // Never default an absent status to "success" — that would let a malformed
  // or unexpected event credit a wallet for a payment that never happened.
  // Unrecognised statuses normalise to "pending", which credits nothing.
  const providerStatus = extractGatewayStatus(payload)
  const paidAmount = extractGatewayAmount(payload)

  // The webhook and the post-checkout callback share one settlement path, so
  // they cannot disagree about when balance is created. Idempotency (and the
  // PENDING -> terminal compare-and-swap that prevents a double credit when a
  // retry races the callback) lives in settleDeposit.
  const result = await settleDeposit({ reference, providerStatus, paidAmount })

  if (result.outcome === "unknown_reference") {
    return NextResponse.json({ error: "Unknown reference" }, { status: 404 })
  }

  // Anything else — credited, already settled, marked failed, still pending,
  // amount mismatch, not a deposit — is a successfully handled event and gets
  // a 200 so Paystack stops retrying it.
  return NextResponse.json({ received: true, outcome: result.outcome })
}

export { mockWebhookSignature }
