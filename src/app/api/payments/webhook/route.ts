import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyWebhookSignature, mockWebhookSignature } from "@/lib/paymentProvider"

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

  const data = payload.data as Record<string | number, unknown> | undefined
  const reference =
    typeof data?.reference === "string"
      ? data.reference
      : typeof payload.reference === "string"
        ? payload.reference
        : undefined

  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 })
  }

  const statusRaw = (data?.status as string) ?? (payload.status as string) ?? "success"
  const status = statusRaw === "failed" ? "FAILED" : statusRaw === "successful" ? "COMPLETED" : "PENDING"

  const existing = await prisma.walletTransaction.findUnique({
    where: { reference },
  })

  if (!existing) {
    return NextResponse.json({ error: "Unknown reference" }, { status: 404 })
  }

  await prisma.walletTransaction.update({
    where: { reference },
    data: { status },
  })

  return NextResponse.json({ received: true })
}

export { mockWebhookSignature }
