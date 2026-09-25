import {
  SMS_COUNTRIES,
  SMS_ORDER_TTL_MS,
  SMS_POLL_INTERVAL_MS,
  USD_TO_NGN_RATE,
} from "@/lib/sms-catalog"
import { assertNoMockProvidersInProduction } from "@/lib/assertProductionEnv"
import { normalizeFiveSimPrices } from "@/lib/sms-provider-catalog"

/**
 * SMS provider integration layer (Phase 3).
 *
 * Talks to a 5sim-compatible REST API using SMS_PROVIDER_BASE_URL and
 * SMS_PROVIDER_API_KEY. When no API key is configured (or
 * SMS_PROVIDER_MOCK=true), an in-process mock provider is used instead so
 * the whole purchase/polling/refund flow can be exercised in development
 * without a provider account.
 *
 * Mock test sentinels (only recognised by the mock provider — they are priced
 * in the mock catalog so the order API accepts them, but they are filtered
 * out of the public /api/sms/catalog response):
 *  - service `outofstock`  → price lookup returns null / buy fails with NO_STOCK
 *  - service `noship`      → price exists, but buying always fails with NO_STOCK
 *  - service `ratelimit`   → checkSmsCode always fails with RATE_LIMITED
 *  - service `slowcode`    → code never arrives (for timeout/refund testing)
 */

export class SmsProviderError extends Error {
  constructor(
    public code:
      | "NOT_CONFIGURED"
      | "NO_STOCK"
      | "RATE_LIMITED"
      | "AUTH_FAILED"
      | "INVALID_ORDER"
      | "NETWORK_ERROR"
      | "PROVIDER_ERROR",
    message: string,
    public httpStatus = 502
  ) {
    super(message)
  }
}

export interface SmsActivation {
  /** Provider-side activation id (stored on SmsOrder.orderId). */
  orderId: string
  /** E.164-ish phone number as returned by the provider. */
  phoneNumber: string
}

export type SmsCheckResult = {
  status: "PENDING" | "RECEIVED" | "CANCELLED" | "EXPIRED"
  code: string | null
}

export type SmsCancelResult = {
  ok: boolean
  /** "FINISHED" = provider says the activation already ended. */
  reason?: string
}

const BASE_URL = (process.env.SMS_PROVIDER_BASE_URL ?? "https://5sim.net").replace(/\/+$/, "")
const API_KEY = process.env.SMS_PROVIDER_API_KEY?.trim()
const REQUEST_TIMEOUT_MS = 15_000

export function isMockProvider(): boolean {
  assertNoMockProvidersInProduction()
  if (process.env.SMS_PROVIDER_MOCK === "true") return true
  if (process.env.SMS_PROVIDER_MOCK === "false") return false
  // No key configured outside production → fall back to the mock provider
  // so the feature is usable in local development.
  return !API_KEY && process.env.NODE_ENV !== "production"
}

export function isProviderConfigured(): boolean {
  return isMockProvider() || Boolean(API_KEY)
}

function assertConfigured() {
  if (!isProviderConfigured()) {
    throw new SmsProviderError(
      "NOT_CONFIGURED",
      "SMS provider is not configured. Set SMS_PROVIDER_API_KEY in your environment.",
      503
    )
  }
}

// ---------------------------------------------------------------------------
// Mock provider
// ---------------------------------------------------------------------------

interface MockOrder {
  externalId: string
  country: string
  service: string
  phoneNumber: string
  code: string
  codeArrivesAt: number
  cancelled: boolean
}

const mockGlobal = globalThis as unknown as {
  __smsMockOrders?: Map<string, MockOrder>
}
const mockOrders = (mockGlobal.__smsMockOrders ??= new Map<string, MockOrder>())

// Base USD price per service. These are the *reference* rates (roughly the
// cheapest market); a per-country multiplier is applied on top so each country
// yields its own distinct price, mirroring how the live provider prices stock.
const MOCK_BASE_PRICES: Record<string, number> = {
  whatsapp: 0.35,
  telegram: 0.3,
  google: 0.25,
  facebook: 0.4,
  instagram: 0.5,
  twitter: 0.45,
  x: 0.45,
  openai: 0.6,
  chatgpt: 0.6,
  steam: 0.3,
  uber: 0.5,
  paypal: 0.4,
  signal: 0.35,
  tinder: 0.55,
  snapchat: 0.4,
  linkedin: 0.35,
  microsoft: 0.3,
  apple: 0.35,
  amazon: 0.4,
  discord: 0.3,
  viber: 0.3,
  line: 0.3,
  wechat: 0.4,
  zoom: 0.35,
  skype: 0.3,
  yahoo: 0.3,
  yandex: 0.3,
  mailru: 0.3,
  rambler: 0.3,
  olx: 0.35,
  spotify: 0.4,
  netflix: 0.5,
  twitch: 0.4,
  reddit: 0.3,
  pinterest: 0.3,
  tiktok: 0.4,
  youtube: 0.35,
  github: 0.3,
  gitlab: 0.3,
  bitbucket: 0.3,
  wordpress: 0.3,
  blogger: 0.3,
  medium: 0.3,
  quora: 0.3,
  airbnb: 0.4,
  booking: 0.45,
  coinbase: 0.5,
  binance: 0.5,
  kraken: 0.5,
  patreon: 0.4,
  onlyfans: 0.6,
  chime: 0.35,
  wise: 0.35,
  revolut: 0.35,
  venmo: 0.4,
  cashapp: 0.4,
  adidas: 0.4,
  nike: 0.4,
  ebay: 0.35,
  aliexpress: 0.4,
}

/**
 * Per-country pricing profile for the mock provider.
 *
 * `multiplier` scales the base service rate — reflecting real market variation
 * (US/UK numbers cost more, India/Philippines much less).
 *
 * `services` lists which products the country actually stocks, so different
 * countries surface different availability, exactly as a real supplier does.
 * When omitted, all services are stocked.
 */
interface MockCountryProfile {
  multiplier: number
  services?: string[]
}

const DEFAULT_MOCK_PROFILE: MockCountryProfile = { multiplier: 1 }

const MOCK_COUNTRY_PROFILES: Record<string, MockCountryProfile> = {
  usa: { multiplier: 1.6 },
  england: { multiplier: 1.45 },
  canada: { multiplier: 1.4 },
  germany: { multiplier: 1.3 },
  france: { multiplier: 1.25 },
  nigeria: { multiplier: 0.9 },
  india: { multiplier: 0.55 },
  philippines: { multiplier: 0.6 },
}

function mockProfileFor(country: string): MockCountryProfile {
  return MOCK_COUNTRY_PROFILES[country.toLowerCase()] ?? DEFAULT_MOCK_PROFILE
}

/** True when the given country is expected to stock the given service. */
function mockCountryStocksService(country: string, service: string): boolean {
  const { services } = mockProfileFor(country)
  if (!services) return true
  return services.includes(service)
}

/**
 * Prices for the sentinel pseudo-services so they can be ordered end-to-end
 * through the order API (`outofstock` stays unpriced → catalog miss).
 */
const MOCK_SENTINEL_PRICES: Record<string, number> = {
  noship: 0.45,
  ratelimit: 0.3,
  slowcode: 0.4,
}

/**
 * Codes that exist only to drive the mock provider's failure paths (no stock,
 * rate limit, never-delivered). They are priced so the order API accepts them
 * and can exercise its compensation logic, so they must be filtered out at the
 * public catalog boundary rather than here.
 */
export const SMS_MOCK_SENTINELS: ReadonlySet<string> = new Set([
  ...Object.keys(MOCK_SENTINEL_PRICES),
  "outofstock",
])

const MOCK_CODE_DELAY_MS = Number(process.env.SMS_PROVIDER_MOCK_CODE_DELAY_MS ?? 8000)

/**
 * Resolves the mock price (in USD) for a country/service pair.
 *
 * The country genuinely changes the result: the base service rate is scaled by
 * that country's multiplier. Returns null when the country does not stock the
 * service at all, which is how the catalog surfaces "unavailable".
 */
function mockPrice(country: string, service: string): number | null {
  if (service === "outofstock") return null
  if (!mockCountryStocksService(country, service)) return null
  const base = MOCK_BASE_PRICES[service] ?? MOCK_SENTINEL_PRICES[service]
  if (base === undefined) return null
  return base * mockProfileFor(country).multiplier
}

function mockRequestNumber(country: string, service: string): SmsActivation {
  if (service === "outofstock" || service === "noship") {
    throw new SmsProviderError(
      "NO_STOCK",
      `Provider has no numbers in stock for ${country}/${service}.`,
      409
    )
  }
  const externalId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const phoneNumber = `+1${String(Math.floor(Math.random() * 1e10)).padStart(10, "0")}`
  mockOrders.set(externalId, {
    externalId,
    country,
    service,
    phoneNumber,
    code: String(Math.floor(100000 + Math.random() * 900000)),
    // `slowcode` never delivers — used to test the timeout/refund path.
    codeArrivesAt:
      service === "slowcode"
        ? Number.MAX_SAFE_INTEGER
        : Date.now() + MOCK_CODE_DELAY_MS,
    cancelled: false,
  })
  return { orderId: externalId, phoneNumber }
}

function mockCheckSmsCode(externalId: string): SmsCheckResult {
  if (serviceChecksRateLimit(externalId)) {
    throw new SmsProviderError(
      "RATE_LIMITED",
      "SMS provider rate limit reached. Slow down and retry shortly.",
      429
    )
  }
  const order = mockOrders.get(externalId)
  if (!order) {
    throw new SmsProviderError("INVALID_ORDER", "Unknown activation id.", 404)
  }
  if (order.cancelled) return { status: "CANCELLED", code: null }
  if (Date.now() >= order.codeArrivesAt) {
    return { status: "RECEIVED", code: order.code }
  }
  return { status: "PENDING", code: null }
}

function serviceChecksRateLimit(externalId: string): boolean {
  const order = mockOrders.get(externalId)
  return order?.service === "ratelimit"
}

function mockCancelOrder(externalId: string): SmsCancelResult {
  const order = mockOrders.get(externalId)
  if (!order) {
    throw new SmsProviderError("INVALID_ORDER", "Unknown activation id.", 404)
  }
  order.cancelled = true
  return { ok: true }
}

// ---------------------------------------------------------------------------
// 5sim-compatible HTTP adapter
// ---------------------------------------------------------------------------

async function providerFetch(
  path: string,
  { authenticated = true }: { authenticated?: boolean } = {}
): Promise<unknown> {
  if (authenticated && !API_KEY) {
    throw new SmsProviderError(
      "NOT_CONFIGURED",
      "SMS provider is not configured. Set SMS_PROVIDER_API_KEY in your environment.",
      503
    )
  }

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: {
        ...(authenticated ? { Authorization: `Bearer ${API_KEY}` } : {}),
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    throw new SmsProviderError(
      "NETWORK_ERROR",
      `Could not reach the SMS provider: ${error instanceof Error ? error.message : "network error"}`,
      504
    )
  }

  if (response.status === 429) {
    throw new SmsProviderError(
      "RATE_LIMITED",
      "SMS provider rate limit reached. Please retry in a few seconds.",
      429
    )
  }
  if (response.status === 401 || response.status === 403) {
    throw new SmsProviderError(
      "AUTH_FAILED",
      "SMS provider rejected the API key.",
      502
    )
  }
  if (!response.ok) {
    const text = (await response.text().catch(() => "")).toLowerCase()
    if (response.status === 400 && (text.includes("no free phones") || text.includes("no products"))) {
      throw new SmsProviderError(
        "NO_STOCK",
        "Provider has no numbers in stock for this selection.",
        409
      )
    }
    throw new SmsProviderError(
      "PROVIDER_ERROR",
      `SMS provider error (HTTP ${response.status}).`,
      502
    )
  }

  return response.json()
}

export async function assertProviderAuthenticated(): Promise<void> {
  assertConfigured()
  if (isMockProvider()) return

  const payload = (await providerFetch(`/v1/user/profile`)) as {
    id?: number | string
  }
  if (payload?.id === undefined || payload?.id === null) {
    throw new SmsProviderError(
      "PROVIDER_ERROR",
      "Provider returned an unexpected account profile response.",
      502
    )
  }
}

interface FiveSimActivation {
  id: number | string
  phone: string
}

interface FiveSimCheck {
  status: string
  sms?: { code: string }[]
}

function fiveSimCheckToResult(payload: FiveSimCheck): SmsCheckResult {
  const code = payload.sms?.[0]?.code ?? null
  switch (payload.status) {
    // RECEIVED and FINISHED both mean the SMS is in. 5sim flips an activation
    // to FINISHED shortly after delivery, so a poll landing on FINISHED must
    // still surface the code — dropping it would wrongly refund the user.
    // FINISHED without any stored SMS is definitively over → EXPIRED (refund).
    case "RECEIVED":
    case "FINISHED":
      if (code) return { status: "RECEIVED", code }
      return payload.status === "FINISHED"
        ? { status: "EXPIRED", code: null }
        : { status: "PENDING", code: null }
    case "CANCELED":
      return { status: "CANCELLED", code: null }
    case "TIMEOUT":
    case "BANNED":
      return { status: "EXPIRED", code: null }
    default:
      return { status: "PENDING", code: null }
  }
}

// ---------------------------------------------------------------------------
// Public provider API (dispatches between mock and real implementations)
// ---------------------------------------------------------------------------

/** Full catalog price list for one country, keyed by service code. */
export async function getProviderCatalog(
  country: string
): Promise<Record<string, number>> {
  // Browsing prices is public and must not depend on the purchase credential.
  // Only purchase/status operations require a configured provider account.
  if (isMockProvider()) {
    const prices: Record<string, number> = {}
    for (const code of [
      ...Object.keys(MOCK_BASE_PRICES),
      ...Object.keys(MOCK_SENTINEL_PRICES),
      "outofstock",
    ]) {
      const price = mockPrice(country, code)
      if (price !== null) prices[code] = price * USD_TO_NGN_RATE
    }
    return prices
  }

  // `/v1/guest/prices` is 5sim's public catalog endpoint. The old
  // `/v1/guest/products/{country}` route now returns 404, which used to make
  // the entire country/service UI empty. No API key is required for browsing.
  const payload = await providerFetch(
    `/v1/guest/prices?country=${encodeURIComponent(country)}`,
    { authenticated: false }
  )
  return normalizeFiveSimPrices(payload, country, USD_TO_NGN_RATE)
}

/** Rent a virtual number for `country`/`service`. Throws SmsProviderError. */
export async function requestNumber(
  country: string,
  service: string
): Promise<SmsActivation> {
  assertConfigured()
  if (isMockProvider()) return mockRequestNumber(country, service)

  const payload = (await providerFetch(
    `/v1/user/buy/activation/${encodeURIComponent(country)}/any/${encodeURIComponent(service)}`
  )) as FiveSimActivation
  if (!payload?.id || !payload?.phone) {
    throw new SmsProviderError(
      "PROVIDER_ERROR",
      "Provider returned an unexpected response while renting a number.",
      502
    )
  }
  return { orderId: String(payload.id), phoneNumber: payload.phone }
}

/** Poll the provider for an incoming verification code. */
export async function checkSmsCode(externalOrderId: string): Promise<SmsCheckResult> {
  assertConfigured()
  if (isMockProvider()) return mockCheckSmsCode(externalOrderId)

  const payload = (await providerFetch(
    `/v1/user/check/${encodeURIComponent(externalOrderId)}`
  )) as FiveSimCheck
  return fiveSimCheckToResult(payload)
}

/** Release/cancel a rented number (only valid before a code arrives). */
export async function cancelOrder(externalOrderId: string): Promise<SmsCancelResult> {
  assertConfigured()
  if (isMockProvider()) return mockCancelOrder(externalOrderId)

  try {
    await providerFetch(`/v1/user/cancel/${encodeURIComponent(externalOrderId)}`)
    return { ok: true }
  } catch (error) {
    if (error instanceof SmsProviderError && error.httpStatus === 409) {
      // e.g. "no free phones" style 400s are mapped to NO_STOCK; a cancel on a
      // finished activation surfaces as a plain 400 → treat as already ended.
      return { ok: false, reason: "FINISHED" }
    }
    if (error instanceof SmsProviderError && error.code === "RATE_LIMITED") throw error
    return { ok: false, reason: "FINISHED" }
  }
}

/** Utility export for API responses. */
export { SMS_COUNTRIES, SMS_ORDER_TTL_MS, SMS_POLL_INTERVAL_MS, USD_TO_NGN_RATE }

