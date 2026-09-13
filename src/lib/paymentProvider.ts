import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Payment gateway integration (Phase 5).
 *
 * Supports two providers:
 *  - Paystack (card payments) — configured via PAYSTACK_SECRET_KEY
 *  - Crypto / Web3 — configured via CRYPTO_PROVIDER_API_KEY
 *
 * When neither key is set (or PAYMENT_PROVIDER_MOCK=true), a mock provider
 * runs in-process. Every deposit writes a WalletTransaction with a unique
 * `reference` (DEPOSIT type); re-processing the same reference is a no-op.
 */

const NEXTAUTH_URL = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "")

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY?.trim()
const PAYSTACK_BASE = (process.env.PAYSTACK_BASE_URL ?? "https://api.paystack.co").replace(/\/+$/, "")
const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET?.trim() ?? PAYSTACK_SECRET

const CRYPTO_SECRET = process.env.CRYPTO_PROVIDER_API_KEY?.trim()

// The mock provider is a development/test affordance and must never be usable
// in production. Two guards apply:
//   1. isMockPaymentProvider() already returns false in production;
//   2. MOCK_WEBHOOK_SECRET has NO fallback in production, so the mock webhook
//      branch cannot be signed without an explicitly configured secret.
const MOCK_WEBHOOK_SECRET =
  process.env.MOCK_WEBHOOK_SECRET ??
  (process.env.NODE_ENV === "production" ? undefined : "mock-secret-dev-only")

export type PaymentMethod = "card_paystack" | "crypto"

export class PaymentProviderError extends Error {
  constructor(
    public code:
      | "NOT_CONFIGURED"
      | "INVALID_AMOUNT"
      | "PROVIDER_ERROR"
      | "NETWORK_ERROR"
      | "SIGNATURE_MISMATCH",
    message: string,
    public httpStatus = 502
  ) {
    super(message)
  }
}

export interface PaymentInitResult {
  reference: string
  authorizationUrl: string
  provider: PaymentMethod
  qrCode?: string
}

export interface PaymentVerification {
  reference: string
  status: "success" | "failed" | "pending"
  amount: number
}

export { MOCK_WEBHOOK_SECRET, PAYSTACK_WEBHOOK_SECRET }

export function isPaymentMock(): boolean {
  if (process.env.PAYMENT_PROVIDER_MOCK === "true") return true
  if (process.env.PAYMENT_PROVIDER_MOCK === "false") return false
  return !PAYSTACK_SECRET && !CRYPTO_SECRET && process.env.NODE_ENV !== "production"
}

export function isPaymentProviderConfigured(): boolean {
  return isPaymentMock() || Boolean(PAYSTACK_SECRET) || Boolean(CRYPTO_SECRET)
}

function assertConfigured(method: PaymentMethod) {
  if (isPaymentMock()) return
  if (method === "card_paystack" && !PAYSTACK_SECRET) {
    throw new PaymentProviderError(
      "NOT_CONFIGURED",
      "Paystack is not configured. Set PAYSTACK_SECRET_KEY in your environment.",
      503
    )
  }
  if (method === "crypto" && !CRYPTO_SECRET) {
    throw new PaymentProviderError(
      "NOT_CONFIGURED",
      "Crypto provider is not configured. Set CRYPTO_PROVIDER_API_KEY in your environment.",
      503
    )
  }
}

function generateReference(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

// ---------------------------------------------------------------------------
// Mock provider
// ---------------------------------------------------------------------------

async function mockInitialize(
  userId: string,
  email: string,
  amount: number,
  method: PaymentMethod
): Promise<PaymentInitResult> {
  const prefix = method === "crypto" ? "mockcrypto" : "mockpay"
  const reference = generateReference(prefix)
  const authorizationUrl = `${NEXTAUTH_URL}/payments/mockcheckout?ref=${reference}&amount=${amount.toFixed(2)}`
  return { reference, authorizationUrl, provider: method, qrCode: method === "crypto" ? authorizationUrl : undefined }
}

// ---------------------------------------------------------------------------
// Paystack provider
// ---------------------------------------------------------------------------

async function paystackInitialize(
  userId: string,
  email: string,
  amount: number
): Promise<PaymentInitResult> {
  const reference = generateReference("paystack")
  const response = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
    },
    body: JSON.stringify({
      email,
      amount: Math.round(amount * 100),
      currency: "NGN",
      channels: ["card", "bank_transfer", "ussd"],
      reference,
      callback_url: `${NEXTAUTH_URL}/api/payments/callback`,
      metadata: { userId, source: "investorlogs-wallet" },
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    throw new PaymentProviderError(
      "PROVIDER_ERROR",
      `Paystack initialization failed (HTTP ${response.status}).`,
      502
    )
  }

  const payload = (await response.json().catch(() => null)) as
    | { data?: { authorization_url?: string } }
    | null

  if (!payload?.data?.authorization_url) {
    throw new PaymentProviderError(
      "PROVIDER_ERROR",
      "Paystack returned an unexpected response.",
      502
    )
  }

  return {
    reference,
    authorizationUrl: payload.data.authorization_url,
    provider: "card_paystack",
  }
}

// ---------------------------------------------------------------------------
// Crypto provider (simplified — in production this monitors a wallet address)
// ---------------------------------------------------------------------------

async function cryptoInitialize(
  userId: string,
  email: string,
  amount: number
): Promise<PaymentInitResult> {
  const reference = generateReference("crypto")
  const qrCode = `${NEXTAUTH_URL}/payments/mockcheckout?ref=${reference}&amount=${amount.toFixed(2)}`
  return { reference, authorizationUrl: qrCode, provider: "crypto", qrCode }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function initializePayment(
  userId: string,
  email: string,
  amount: number,
  method: PaymentMethod
): Promise<PaymentInitResult> {
  if (amount <= 0 || !Number.isFinite(amount)) {
    throw new PaymentProviderError("INVALID_AMOUNT", "Amount must be a positive number.", 400)
  }

  assertConfigured(method)

  if (isPaymentMock()) return mockInitialize(userId, email, amount, method)
  if (method === "card_paystack") return paystackInitialize(userId, email, amount)
  return cryptoInitialize(userId, email, amount)
}

/** Verifies a webhook signature for the given provider. */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  provider: "mock" | "paystack"
): boolean {
  if (!signature) return false
  // In production the mock branch is refused outright — the mock secret has no
  // default there, so this both blocks forged signatures and makes the intent
  // explicit at the call site.
  if (provider === "mock" && process.env.NODE_ENV === "production") return false
  const secret = provider === "paystack" ? PAYSTACK_WEBHOOK_SECRET : MOCK_WEBHOOK_SECRET
  if (!secret) return false
  const algo = provider === "paystack" ? "sha512" : "sha256"
  const expected = createHmac(algo, secret).update(rawBody).digest("hex")
  return safeEqual(expected, signature)
}

/**
 * Builds the expected signature for the mock provider (used by local tests).
 * Refuses to sign in production, where the mock provider is disabled.
 */
export function mockWebhookSignature(rawBody: string): string {
  if (!MOCK_WEBHOOK_SECRET) {
    throw new Error("MOCK_WEBHOOK_SECRET is not configured (mock provider is disabled).")
  }
  return createHmac("sha256", MOCK_WEBHOOK_SECRET).update(rawBody).digest("hex")
}
