import { createHmac, timingSafeEqual } from "node:crypto"
import { PaymentInitResult, PaymentVerification } from "@/lib/paymentProvider"

const FLW_SECRET = process.env.FLUTTERWAVE_SECRET_KEY?.trim()
const FLW_PUBLIC = process.env.FLUTTERWAVE_PUBLIC_KEY?.trim()
const FLW_BASE = (process.env.FLUTTERWAVE_BASE_URL ?? "https://api.flutterwave.com/v3").replace(/\/+$/, "")
const NEXTAUTH_URL = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "")

export const FLUTTERWAVE_WEBHOOK_SECRET = process.env.FLUTTERWAVE_WEBHOOK_SECRET?.trim() ?? FLW_SECRET

// A valid Flutterwave secret is at least 20 characters. Transport security is
// handled by TLS on every request.
const FLW_SECRET_TOO_SHORT = FLW_SECRET && FLW_SECRET.length < 20

export function isFlutterwaveConfigured(): boolean {
  return Boolean(FLW_SECRET) && Boolean(FLW_PUBLIC) && !FLW_SECRET_TOO_SHORT
}

function assertFlutterwaveConfigured() {
  if (!isFlutterwaveConfigured()) {
    throw new FlutterwaveProviderError(
      "NOT_CONFIGURED",
      "Flutterwave is not configured. Set FLUTTERWAVE_SECRET_KEY and FLUTTERWAVE_PUBLIC_KEY in your environment.",
      503
    )
  }
}

/** Initialize a Flutterwave bank transfer session + return bank details. */
export async function flutterwaveInitialize(
  userId: string,
  email: string,
  amount: number
): Promise<PaymentInitResult> {
  assertFlutterwaveConfigured()

  const reference = flutterwaveGenerateReference("flutterwave")
  const response = await fetch(`${FLW_BASE}/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FLW_SECRET}`,
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      currency: "NGN",
      payment_type: "bank_transfer",
      redirect_url: `${NEXTAUTH_URL}/api/payments/callback`,
      phone: userId,
      email,
      meta: {
        userId,
        source: "investorplugx-wallet",
        provider: "flutterwave",
      },
      customizations: {
        title: "InvestorPlugX",
        description: `Deposit ₦${amount.toFixed(2)}`,
      },
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const body = (await response.text().catch(() => "")) as string
    throw new FlutterwaveProviderError(
      "PROVIDER_ERROR",
      `Flutterwave initialization failed (HTTP ${response.status}): ${body}`,
      502
    )
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        data?: {
          link?: string
          reference?: string
          virtual_account_number?: string
          virtual_account_bank_name?: string
          virtual_account_bank_code?: string
          virtual_account_name?: string
        }
      }
    | null

  if (!payload?.data) {
    const body = JSON.stringify(payload)
    throw new FlutterwaveProviderError(
      "PROVIDER_ERROR",
      `Flutterwave returned an unexpected response: ${body}`,
      502
    )
  }

  const { data } = payload

  return {
    reference: data.reference ?? reference,
    authorizationUrl: undefined,
    provider: "transfer_flutterwave",
    ...(data.virtual_account_number
      ? {
          bankDetails: {
            accountNumber: data.virtual_account_number,
            bankName: data.virtual_account_bank_name ?? "Unknown Bank",
            bankCode: data.virtual_account_bank_code ?? "",
            accountName: data.virtual_account_name ?? userId,
          },
        }
      : {}),
  }
}

/**
 * Verify a charged transaction with Flutterwave (used by callback + webhook).
 * Returns the normalised status and the amount the gateway confirmed, in naira.
 */
export async function flutterwaveVerifyPayment(
  reference: string
): Promise<PaymentVerification> {
  if (process.env.NODE_ENV === "production" && !FLW_SECRET) {
    throw new FlutterwaveProviderError(
      "NOT_CONFIGURED",
      "Flutterwave is not configured. Set FLUTTERWAVE_SECRET_KEY in your environment.",
      503
    )
  }

  const response = await fetch(`${FLW_BASE}/transactions/${encodeURIComponent(reference)}/verify`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${FLW_SECRET}`,
    },
  })

  if (!response.ok) {
    throw new FlutterwaveProviderError(
      "PROVIDER_ERROR",
      `Flutterwave verification failed (HTTP ${response.status}).`,
      502
    )
  }

  const payload = (await response.json().catch(() => null)) as
    | { data?: { status?: string; amount?: string; currency?: string } }
    | null

  if (!payload?.data) {
    throw new FlutterwaveProviderError(
      "PROVIDER_ERROR",
      "Flutterwave returned an unexpected verification response.",
      502
    )
  }

  const status = String(payload.data.status ?? "").toLowerCase()
  const amountRaw = payload.data.amount ?? payload.data.currency
  const currency = payload.data.currency ?? "NGN"

  return {
    reference,
    status: flutterwaveNormalizeProviderStatus(status),
    amount: flutterwaveKoboToNaira(amountRaw) ?? 0,
    provider: "flutterwave",
    currency,
  }
}

/**
 * Generate a unique reference for a payment on the given provider prefix.
 */
export function flutterwaveGenerateReference(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

/** Convert kobo (Flutterwave's minor unit) to naira, or null if unusable. */
export function flutterwaveKoboToNaira(kobo: unknown): number | null {
  const value = typeof kobo === "string" ? Number(kobo) : kobo
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null
  }
  return Math.round(value) / 100
}

/**
 * Normalises a gateway status string (shared with the Paystack module).
 */
export function flutterwaveNormalizeProviderStatus(raw: unknown): "success" | "failed" | "pending" {
  if (typeof raw !== "string") return "pending"
  const value = raw.trim().toLowerCase()
  if (["success", "successful", "succeeded", "complete", "completed"].includes(value)) return "success"
  if (["fail", "failed", "failure", "abandoned", "cancelled", "canceled", "reversed"].includes(value)) return "failed"
  return "pending"
}

/**
 * A payment provider error, thrown when a Flutterwave API call fails.
 */
export class FlutterwaveProviderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 502
  ) {
    super(message)
    this.name = "FlutterwaveProviderError"
  }
}

