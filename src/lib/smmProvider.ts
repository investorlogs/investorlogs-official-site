import { SMM_POLL_INTERVAL_MS, SMM_PLATFORMS, SMM_PROVIDER_PRICE_CURRENCY, type SmmService } from "@/lib/smm-catalog"
import { normalizeSmmCatalog } from "@/lib/smm-provider-catalog"
import { assertNoMockProvidersInProduction } from "@/lib/assertProductionEnv"

/**
 * SMM provider integration layer (Phase 4).
 *
 * Talks to a standard SMM panel v2-style REST API using
 * SMM_PROVIDER_API_KEY and SMM_PROVIDER_BASE_URL. When no API key is
 * configured (or SMM_PROVIDER_MOCK=true), an in-process mock provider is
 * used instead so the whole order/polling flow can be exercised in
 * development without a provider account.
 */

export class SmmProviderError extends Error {
  constructor(
    public code:
      | "NOT_CONFIGURED"
      | "NO_STOCK"
      | "RATE_LIMITED"
      | "AUTH_FAILED"
      | "INVALID_SERVICE"
      | "INVALID_ORDER"
      | "INSUFFICIENT_BALANCE"
      | "PROVIDER_ERROR"
      | "NETWORK_ERROR",
    message: string,
    public httpStatus = 502
  ) {
    super(message)
  }
}

export const SMM_STATUSES = ["Pending", "Processing", "Completed", "Canceled", "Partial"] as const
export type SmmProviderStatus = (typeof SMM_STATUSES)[number]

/** Maps a provider status string to the local SmmStatus enum value. */
export function mapProviderStatus(status: string): SmmProviderStatus {
  const s = status.toLowerCase()
  if (s === "pending") return "Pending"
  if (s === "processing" || s === "in progress") return "Processing"
  if (s === "completed" || s === "completed ") return "Completed"
  if (s === "canceled" || s === "cancelled") return "Canceled"
  if (s === "partial") return "Partial"
  return "Pending"
}

export interface SmmOrderResult {
  externalOrderId: string
  status: SmmProviderStatus
}

export interface SmmStatusResult {
  status: SmmProviderStatus
  startCount?: number
  remaining?: number
  spent?: number
}

const BASE_URL = (process.env.SMM_PROVIDER_BASE_URL ?? "https://reallysimplesocial.com/api/v2").replace(
  /\/+$/,
  ""
)
const API_KEY = process.env.SMM_PROVIDER_API_KEY?.trim()
const REQUEST_TIMEOUT_MS = 15_000
const MOCK_SMM_DELAY_MS = Number(process.env.SMM_PROVIDER_MOCK_DELAY_MS ?? 5000)

export function isSmmMockProvider(): boolean {
  assertNoMockProvidersInProduction()
  if (process.env.SMM_PROVIDER_MOCK === "true") return true
  if (process.env.SMM_PROVIDER_MOCK === "false") return false
  return !API_KEY && process.env.NODE_ENV !== "production"
}

export function isSmmProviderConfigured(): boolean {
  return isSmmMockProvider() || Boolean(API_KEY)
}

function assertSmmConfigured() {
  if (!isSmmProviderConfigured()) {
    throw new SmmProviderError(
      "NOT_CONFIGURED",
      "SMM provider is not configured. Set SMM_PROVIDER_API_KEY in your environment.",
      503
    )
  }
}

// ---------------------------------------------------------------------------
// Mock provider
// ---------------------------------------------------------------------------

interface MockSmmOrder {
  externalId: string
  serviceId: string
  targetLink: string
  quantity: number
  processingAt: number
  completeAt: number
  startCount: number
  cancelled: boolean
}

const mockGlobal = globalThis as unknown as {
  __smmMockOrders?: Map<string, MockSmmOrder>
}
const mockSmmOrders = (mockGlobal.__smmMockOrders ??= new Map<string, MockSmmOrder>())

/** A mock catalog row before the provider-contract defaults are applied. */
type MockSmmServiceSeed = Omit<SmmService, "providerType" | "orderMode" | "supportsRefill" | "supportsCancel">

// Rates are the provider cost per 1,000 units, quoted in NGN. These mirror the
// real (Really Simple Social) provider's per-1k pricing so the mock is a
// faithful stand-in for end-to-end testing. Every seed is a standard, refillable
// product, so the capability defaults below are applied once instead of being
// repeated on all eighteen rows.
const MOCK_SMM_SERVICE_SEEDS: MockSmmServiceSeed[] = [
  { serviceId: "ig-followers", platform: "Instagram", name: "Instagram Followers", serviceType: "followers", rate: 3750, minQty: 100, maxQty: 100000 },
  { serviceId: "ig-likes", platform: "Instagram", name: "Instagram Likes", serviceType: "likes", rate: 1500, minQty: 100, maxQty: 50000 },
  { serviceId: "ig-views", platform: "Instagram", name: "Instagram Views", serviceType: "views", rate: 400, minQty: 500, maxQty: 200000 },
  { serviceId: "tt-followers", platform: "TikTok", name: "TikTok Followers", serviceType: "followers", rate: 1200, minQty: 100, maxQty: 100000 },
  { serviceId: "tt-likes", platform: "TikTok", name: "TikTok Likes", serviceType: "likes", rate: 100, minQty: 100, maxQty: 50000 },
  { serviceId: "tt-views", platform: "TikTok", name: "TikTok Views", serviceType: "views", rate: 500, minQty: 500, maxQty: 200000 },
  { serviceId: "yt-subscribers", platform: "YouTube", name: "YouTube Subscribers", serviceType: "subscribers", rate: 5000, minQty: 100, maxQty: 50000 },
  { serviceId: "yt-views", platform: "YouTube", name: "YouTube Views", serviceType: "views", rate: 2500, minQty: 1000, maxQty: 500000 },
  { serviceId: "tw-followers", platform: "Twitter", name: "Twitter Followers", serviceType: "followers", rate: 1500, minQty: 100, maxQty: 100000 },
  { serviceId: "tw-retweets", platform: "Twitter", name: "Twitter Retweets", serviceType: "retweets", rate: 800, minQty: 100, maxQty: 25000 },
  { serviceId: "fb-page-likes", platform: "Facebook", name: "Facebook Page Likes", serviceType: "likes", rate: 1200, minQty: 100, maxQty: 100000 },
  { serviceId: "fb-video-views", platform: "Facebook", name: "Facebook Video Views", serviceType: "views", rate: 300, minQty: 500, maxQty: 200000 },
  { serviceId: "tg-members", platform: "Telegram", name: "Telegram Channel Members", serviceType: "followers", rate: 800, minQty: 100, maxQty: 100000 },
  { serviceId: "tg-post-views", platform: "Telegram", name: "Telegram Post Views", serviceType: "views", rate: 250, minQty: 500, maxQty: 200000 },
  { serviceId: "spotify-streams", platform: "Spotify", name: "Spotify Streams", serviceType: "views", rate: 200, minQty: 1000, maxQty: 1000000 },
  { serviceId: "spotify-followers", platform: "Spotify", name: "Spotify Followers", serviceType: "followers", rate: 600, minQty: 100, maxQty: 100000 },
  { serviceId: "snap-followers", platform: "Snapchat", name: "Snapchat Followers", serviceType: "followers", rate: 2000, minQty: 100, maxQty: 100000 },
  { serviceId: "snap-story-views", platform: "Snapchat", name: "Snapchat Story Views", serviceType: "views", rate: 300, minQty: 500, maxQty: 200000 },
]

const MOCK_SMM_SERVICES: SmmService[] = MOCK_SMM_SERVICE_SEEDS.map((seed) => ({
  ...seed,
  providerType: "Default",
  orderMode: "standard",
  supportsRefill: false,
  supportsCancel: true,
}))
function mockGetCatalog(): SmmService[] {
  return MOCK_SMM_SERVICES.map((s) => ({ ...s }))
}

function mockCreateOrder(
  serviceId: string,
  targetLink: string,
  quantity: number
): SmmOrderResult {
  const service = MOCK_SMM_SERVICES.find((s) => s.serviceId === serviceId)
  if (!service) {
    throw new SmmProviderError("INVALID_SERVICE", `Unknown service: ${serviceId}`, 400)
  }
  if (quantity < service.minQty || quantity > service.maxQty) {
    throw new SmmProviderError(
      "INVALID_SERVICE",
      `Quantity ${quantity} is outside the allowed range (${service.minQty}–${service.maxQty}) for ${service.name}.`,
      400
    )
  }

  const externalId = `smmock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const startCount = Math.floor(quantity * 0.3)
  mockSmmOrders.set(externalId, {
    externalId,
    serviceId,
    targetLink,
    quantity,
    processingAt: Date.now() + Math.floor(MOCK_SMM_DELAY_MS / 2),
    completeAt: Date.now() + MOCK_SMM_DELAY_MS,
    startCount,
    cancelled: false,
  })

  return { externalOrderId: externalId, status: "Pending" }
}

function mockGetStatus(externalId: string): SmmStatusResult {
  const order = mockSmmOrders.get(externalId)
  if (!order) {
    throw new SmmProviderError("INVALID_ORDER", "Unknown activation id.", 404)
  }
  if (order.cancelled) {
    return { status: "Canceled", startCount: order.startCount, remaining: order.quantity - order.startCount }
  }
  if (Date.now() >= order.completeAt) {
    return { status: "Completed", startCount: order.quantity, remaining: 0, spent: order.quantity }
  }
  if (Date.now() >= order.processingAt) {
    const delivered = Math.floor(order.quantity * 0.7)
    return { status: "Processing", startCount: delivered, remaining: order.quantity - delivered, spent: delivered }
  }
  return { status: "Pending", startCount: order.startCount, remaining: order.quantity - order.startCount }
}

function mockCancelOrder(externalId: string): SmmProviderStatus {
  const order = mockSmmOrders.get(externalId)
  if (!order) {
    throw new SmmProviderError("INVALID_ORDER", "Unknown activation id.", 404)
  }
  order.cancelled = true
  return "Canceled"
}

// ---------------------------------------------------------------------------
// Real SMM v2 API adapter
// ---------------------------------------------------------------------------

interface SmmV2OrderResponse {
  order: number | string
}

interface SmmV2StatusResponse {
  order: number | string
  status: string
  start_count?: number
  remains: number
  spent?: number | string
}

interface SmmV2CancelResponse {
  status?: string
}

async function providerFetch(
  action: string,
  extra: Record<string, unknown> = {}
): Promise<unknown> {
  if (!API_KEY) {
    throw new SmmProviderError(
      "NOT_CONFIGURED",
      "SMM provider is not configured. Set SMM_PROVIDER_API_KEY in your environment.",
      503
    )
  }

  const params = new URLSearchParams({ key: API_KEY, action })
  for (const [k, v] of Object.entries(extra)) {
    params.set(k, String(v))
  }

  let response: Response
  try {
    response = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: params.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    throw new SmmProviderError(
      "NETWORK_ERROR",
      `Could not reach the SMM provider: ${error instanceof Error ? error.message : "network error"}`,
      504
    )
  }

  if (response.status === 429) {
    throw new SmmProviderError(
      "RATE_LIMITED",
      "SMM provider rate limit reached. Please retry in a few seconds.",
      429
    )
  }
  if (response.status === 401 || response.status === 403) {
    throw new SmmProviderError("AUTH_FAILED", "SMM provider rejected the API key.", 502)
  }
  if (!response.ok) {
    const text = (await response.text().catch(() => "")).toLowerCase()
    if (response.status === 400 && text.includes("balance")) {
      throw new SmmProviderError("INSUFFICIENT_BALANCE", "Provider account has insufficient funds.", 409)
    }
    throw new SmmProviderError(
      "PROVIDER_ERROR",
      `SMM provider error (HTTP ${response.status}).`,
      502
    )
  }

  const payload = (await response.json().catch(() => null)) as unknown
  if (payload && typeof payload === "object" && "error" in payload) {
    throw new SmmProviderError("PROVIDER_ERROR", String((payload as { error: unknown }).error), 502)
  }
  return payload ?? {}
}

// ---------------------------------------------------------------------------
// Public provider API (dispatches between mock and real implementations)
// ---------------------------------------------------------------------------

/** Returns all available services from the provider. */
export async function getSmmCatalog(): Promise<SmmService[]> {
  assertSmmConfigured()
  if (isSmmMockProvider()) return mockGetCatalog()

  const payload = await providerFetch("services")
  return normalizeSmmCatalog(payload, SMM_PROVIDER_PRICE_CURRENCY)
}

/** Create an order on the provider side. Throws SmmProviderError. */
export async function createSmmOrder(
  serviceId: string,
  targetLink: string,
  quantity: number
): Promise<SmmOrderResult> {
  assertSmmConfigured()
  if (isSmmMockProvider()) return mockCreateOrder(serviceId, targetLink, quantity)

  const payload = (await providerFetch("add", {
    service: serviceId,
    link: targetLink,
    quantity,
  })) as SmmV2OrderResponse

  if (!payload?.order) {
    throw new SmmProviderError(
      "PROVIDER_ERROR",
      "Provider returned an unexpected response when creating the order.",
      502
    )
  }
  return { externalOrderId: String(payload.order), status: "Pending" }
}

/** Poll the provider for order status. */
export async function getSmmOrderStatus(externalOrderId: string): Promise<SmmStatusResult> {
  assertSmmConfigured()
  if (isSmmMockProvider()) return mockGetStatus(externalOrderId)

  const payload = (await providerFetch("status", {
    order: externalOrderId,
  })) as SmmV2StatusResponse

  if (!payload) {
    throw new SmmProviderError("INVALID_ORDER", "Unknown order id.", 404)
  }
  return {
    status: mapProviderStatus(String(payload.status)),
    startCount: payload.start_count,
    remaining: payload.remains,
    spent: payload.spent ? Number(payload.spent) : undefined,
  }
}

/** Cancel an order on the provider side. */
export async function cancelSmmOrder(externalOrderId: string): Promise<SmmProviderStatus> {
  assertSmmConfigured()
  if (isSmmMockProvider()) return mockCancelOrder(externalOrderId)

  const payload = (await providerFetch("cancel", {
    order: externalOrderId,
  })) as SmmV2CancelResponse

  return mapProviderStatus(payload?.status ?? "Canceled")
}

export { SMM_PLATFORMS, SMM_POLL_INTERVAL_MS }
