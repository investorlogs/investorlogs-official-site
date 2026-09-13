import "server-only"
import { readFileSync } from "fs"
import { resolve } from "path"

// ---------------------------------------------------------------------------
// XclusivePlugs Logs API (reseller / middleman)
//
// Base URL: https://xclusiveplugs.com/api/v1
// Auth:     Authorization: Bearer <XCLUSIVE_PLUGS_API_KEY>
//
// Set in .env:
//   XCLUSIVE_PLUGS_API_KEY="your-bearer-token"
// ---------------------------------------------------------------------------

const XP_BASE_URL = (process.env.XCLUSIVE_PLUGS_API_URL ?? "https://www.xclusiveplugs.com/api/v1").replace(/\/+$/, "")
const XP_API_KEY = process.env.XCLUSIVE_PLUGS_API_KEY?.trim() ?? ""
const XP_TIMEOUT_MS = 20_000

export function isMockProvider(): boolean {
  if (process.env.XCLUSIVE_PLUGS_MOCK === "true") return true
  if (process.env.XCLUSIVE_PLUGS_MOCK === "false") return false
  // No key configured outside production → fall back to the mock provider
  // so the storefront is usable in local development.
  return !XP_API_KEY && process.env.NODE_ENV !== "production"
}

export function isXclusivePlugsConfigured(): boolean {
  return Boolean(XP_API_KEY)
}

export function isMockOrConfigured(): boolean {
  return isMockProvider() || isXclusivePlugsConfigured()
}

// Full mock catalog used as fallback when no real API key is configured
// OR when the real API fails. Mirrors the shape of the live XclusivePlugs
// Logs API response so the UI behaves identically.
const MOCK_PARENT_CATEGORIES: XpParentCategory[] = [
  { id: 1, name: "Accounts", description: "Social and premium account logs", available_categories_count: 20 },
]

const MOCK_LOG_CATEGORIES: XpLogCategory[] = [
  { id: 101, name: "🇮🇩 Indonesia Ads Facebook", description: "Fresh Indonesian IP Facebook accounts. Format: email|password|cookie. Best for ads/managers.", price: "2500.00", currency: "NGN", available_quantity: 37, parent_category: { id: 1, name: "Accounts" } },
  { id: 102, name: "🇺🇸 Direct USA IP Facebook", description: "US residential IP Facebook accounts. Format: email|password|2FA. High trust score.", price: "4200.00", currency: "NGN", available_quantity: 35, parent_category: { id: 1, name: "Accounts" } },
  { id: 103, name: "🇺🇸 Pure USA IP Facebook", description: "Clean USA IP Facebook accounts. Format: email|password. No previous bans.", price: "3900.00", currency: "NGN", available_quantity: 28, parent_category: { id: 1, name: "Accounts" } },
  { id: 104, name: "🇫🇷 Old France Facebook", description: "Aged French Facebook accounts. Format: email|password|recovery email. Good for marketing.", price: "3100.00", currency: "NGN", available_quantity: 19, parent_category: { id: 1, name: "Accounts" } },
  { id: 105, name: "🇳🇬 Old Nigerian Facebook", description: "Nigerian Facebook accounts with aged profiles. Format: email|password|phone.", price: "1800.00", currency: "NGN", available_quantity: 42, parent_category: { id: 1, name: "Accounts" } },
  { id: 106, name: "🇬🇧 UK Facebook", description: "United Kingdom IP Facebook accounts. Format: email|password|2FA.", price: "3600.00", currency: "NGN", available_quantity: 24, parent_category: { id: 1, name: "Accounts" } },
  { id: 107, name: "🇺🇸 Very Old USA Facebook", description: "Very aged US Facebook accounts. Format: email|password|cookie. High durability.", price: "5500.00", currency: "NGN", available_quantity: 15, parent_category: { id: 1, name: "Accounts" } },
  { id: 108, name: "🇨🇦 Canada Facebook", description: "Canadian IP Facebook accounts. Format: email|password|2FA.", price: "4100.00", currency: "NGN", available_quantity: 21, parent_category: { id: 1, name: "Accounts" } },
  { id: 109, name: "🇩🇪 Germany Facebook", description: "German Facebook accounts with local phone verification. Format: email|password.", price: "3400.00", currency: "NGN", available_quantity: 26, parent_category: { id: 1, name: "Accounts" } },
  { id: 110, name: "🇮🇳 India Facebook", description: "Indian Facebook accounts. Format: email|password|phone. Bulk available.", price: "1500.00", currency: "NGN", available_quantity: 55, parent_category: { id: 1, name: "Accounts" } },
  { id: 111, name: "🇧🇷 Brazil Facebook", description: "Brazilian IP Facebook accounts. Format: email|password|cookie.", price: "2200.00", currency: "NGN", available_quantity: 33, parent_category: { id: 1, name: "Accounts" } },
  { id: 112, name: "🇲🇽 Mexico Facebook", description: "Mexican Facebook accounts. Format: email|password|2FA.", price: "2600.00", currency: "NGN", available_quantity: 29, parent_category: { id: 1, name: "Accounts" } },
  { id: 113, name: "🇵🇭 Philippines Facebook", description: "Philippines Facebook accounts. Format: email|password|cookie.", price: "1900.00", currency: "NGN", available_quantity: 38, parent_category: { id: 1, name: "Accounts" } },
  { id: 114, name: "🇹🇭 Thailand Facebook", description: "Thai Facebook accounts. Format: email|password|phone.", price: "2100.00", currency: "NGN", available_quantity: 31, parent_category: { id: 1, name: "Accounts" } },
  { id: 115, name: "🇻🇳 Vietnam Facebook", description: "Vietnamese Facebook accounts. Format: email|password|cookie.", price: "2000.00", currency: "NGN", available_quantity: 36, parent_category: { id: 1, name: "Accounts" } },
  { id: 116, name: "🇪🇬 Egypt Facebook", description: "Egyptian Facebook accounts. Format: email|password|phone.", price: "1700.00", currency: "NGN", available_quantity: 44, parent_category: { id: 1, name: "Accounts" } },
  { id: 117, name: "🇸🇦 Saudi Arabia Facebook", description: "Saudi Arabian Facebook accounts. Format: email|password|2FA.", price: "3200.00", currency: "NGN", available_quantity: 18, parent_category: { id: 1, name: "Accounts" } },
  { id: 118, name: "🇦🇪 UAE Facebook", description: "UAE Facebook accounts. Format: email|password|cookie.", price: "3500.00", currency: "NGN", available_quantity: 22, parent_category: { id: 1, name: "Accounts" } },
  { id: 119, name: "Instagram USA", description: "US IG accounts with profile picture. Format: email|password", price: "3800.00", currency: "NGN", available_quantity: 27, parent_category: { id: 1, name: "Accounts" } },
  { id: 120, name: "Twitter/X Premium", description: "X Premium accounts with verified badge. Format: email|password", price: "5500.00", currency: "NGN", available_quantity: 9, parent_category: { id: 1, name: "Accounts" } },
  { id: 121, name: "TikTok Creator", description: "TikTok accounts with followers. Format: email|password", price: "3100.00", currency: "NGN", available_quantity: 41, parent_category: { id: 1, name: "Accounts" } },
  { id: 122, name: "YouTube Monetized", description: "YTT channels with monetization enabled. Format: email|password", price: "6000.00", currency: "NGN", available_quantity: 12, parent_category: { id: 1, name: "Accounts" } },
  { id: 123, name: "Apple Email", description: "Apple/iCloud email accounts. Format: email|password|recovery email.", price: "2800.00", currency: "NGN", available_quantity: 30, parent_category: { id: 1, name: "Accounts" } },
  { id: 124, name: "CLIPROXY Residential", description: "CLIPROXY residential proxy accounts. Format: host|port|auth|expiry.", price: "4500.00", currency: "NGN", available_quantity: 16, parent_category: { id: 1, name: "Accounts" } },
]

function mockOrder(params: { productId: number | string; quantity: number; idempotencyKey: string }): XpOrderResponse {
  const cat = MOCK_LOG_CATEGORIES.find((c) => Number(c.id) === Number(params.productId))
  if (!cat) {
    return {
      success: false,
      status: 404,
      message: "Log category not found.",
      code: "LOG_CATEGORY_NOT_FOUND",
    }
  }
  if ((cat.available_quantity ?? 0) < params.quantity) {
    return {
      success: false,
      status: 402,
      message: "Out of stock.",
      code: "OUT_OF_STOCK",
    }
  }
  const unit = Number(cat.price) || 0
  const items = Array.from({ length: params.quantity }, (_, i) => ({
    serial: i + 1,
    details: `mock-username-${params.idempotencyKey}-${i + 1}:mock-password-${crypto.randomUUID().slice(0, 8)}`,
    video: null,
  }))
  return {
    success: true,
    data: {
      order_id: `xp-mock-${crypto.randomUUID().slice(0, 12)}`,
      status: "completed",
      product_id: Number(cat.id),
      product_name: cat.name ?? "",
      quantity: params.quantity,
      unit_price: cat.price,
      total: String((unit * params.quantity).toFixed(2)),
      currency: "NGN",
      balance_after: "999999.00",
      items,
    },
  }
}

export type XpParentCategory = {
  id?: number
  name?: string
  description?: string
  image?: string
  available_categories_count?: number
}

export type XpLogCategory = {
  id?: number
  name?: string
  description?: string
  image?: string
  price?: string
  currency?: string
  available_quantity?: number
  parent_category?: { id?: number; name?: string }
}

export type XpOrderItem = {
  serial?: number
  details?: string
  video?: string | null
}

export type XpOrderData = {
  order_id?: string
  status?: string
  product_id?: number
  product_name?: string
  quantity?: number
  unit_price?: string
  total?: string
  currency?: string
  balance_after?: string
  items?: XpOrderItem[]
}

export type XpOrderResponse = {
  success?: boolean
  status?: number
  message?: string
  code?: string
  data?: XpOrderData
}

export type XpWalletResponse = {
  success?: boolean
  data?: { balance?: string; currency?: string }
}

/**
 * Maps an internal account category slug to the XclusivePlugs log category ID.
 * Reads from config/productMap.json (see loadProductMap).
 */
export function getSupplierProductId(slug: string): string | null {
  const id = loadProductMap()[slug]
  return id === undefined ? null : String(id)
}

function loadProductMap(): Record<string, number> {
  try {
    const raw = readFileSync(
      resolve(process.cwd(), "config/productMap.json"),
      "utf-8"
    )
    return JSON.parse(raw) as Record<string, number>
  } catch {
    return {}
  }
}

function xpHeaders(): Record<string, string> {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${XP_API_KEY}`,
  }
}

function logXp(action: string, payload: unknown) {
  if (process.env.XCLUSIVE_PLUGS_DEBUG === "true" || process.env.NODE_ENV !== "production") {
    console.log(`[xclusivePlugs] ${action}`, payload)
  }
}
async function xpRequest<T>(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>
): Promise<T | null> {
  const url = `${XP_BASE_URL}${path}`

  const init: RequestInit = {
    method,
    headers: xpHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(XP_TIMEOUT_MS),
  }
  if (body) {
    init.headers = { ...init.headers, "Content-Type": "application/json" }
    init.body = JSON.stringify(body)
  }

  try {
    const res = await fetch(url, init)
    const responseText = await res.text()
    
    let responseData: unknown
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = responseText
    }

    logXp(`${method} ${path} response`, { status: res.status, data: responseData })

    if (!res.ok) {
      const errorMsg = typeof responseData === "object" && responseData !== null && "message" in responseData
        ? String((responseData as Record<string, unknown>).message)
        : `HTTP ${res.status}: ${responseText.slice(0, 200)}`
      throw new Error(`XclusivePlugs API error: ${errorMsg}`)
    }

    return responseData as T
  } catch (error) {
    logXp(`${method} ${path} error`, {
      error: error instanceof Error ? error.message : "network error",
    })
    throw error
  }
}

export async function fetchParentCategories(): Promise<XpParentCategory[] | null> {
  if (isMockProvider()) return MOCK_PARENT_CATEGORIES
  try {
    const data = await xpRequest<{ success?: boolean; data?: XpParentCategory[] }>(
      "GET",
      "/logs/parent-categories"
    )
    if (!data?.success || !Array.isArray(data.data)) return null
    return data.data
  } catch (error) {
    logXp("fetchParentCategories failed", { error: error instanceof Error ? error.message : String(error) })
    return null
  }
}

export async function fetchLogCategories(params?: {
  parentId?: number
  perPage?: number
  page?: number
}): Promise<XpLogCategory[] | null> {
  if (isMockProvider()) return MOCK_LOG_CATEGORIES
  try {
    const search = new URLSearchParams()
    if (params?.parentId) search.set("parent_category_id", String(params.parentId))
    search.set("per_page", String(params?.perPage ?? 100))
    if (params?.page) search.set("page", String(params.page))
    const query = search.toString() ? `?${search.toString()}` : ""
    const data = await xpRequest<{ success?: boolean; data?: XpLogCategory[] }>(
      "GET",
      `/logs/categories${query}`
    )
    if (!data?.success || !Array.isArray(data.data)) return null
    return data.data
  } catch (error) {
    logXp("fetchLogCategories failed", { error: error instanceof Error ? error.message : String(error) })
    return null
  }
}

export async function fetchLogCategory(
  productId: number | string
): Promise<XpLogCategory | null> {
  if (isMockProvider()) {
    return MOCK_LOG_CATEGORIES.find((c) => Number(c.id) === Number(productId)) ?? null
  }
  try {
    const data = await xpRequest<{ success?: boolean; data?: XpLogCategory }>(
      "GET",
      `/logs/categories/${productId}`
    )
    if (!data?.success || !data.data) return null
    return data.data
  } catch (error) {
    logXp("fetchLogCategory failed", { error: error instanceof Error ? error.message : String(error) })
    return null
  }
}

export async function fetchWalletBalance(): Promise<number | null> {
  if (isMockProvider()) return 99999.00
  try {
    const data = await xpRequest<XpWalletResponse>("GET", "/wallet")
    if (!data?.success || !data.data?.balance) return null
    return Number(data.data.balance)
  } catch (error) {
    logXp("fetchWalletBalance failed", { error: error instanceof Error ? error.message : String(error) })
    return null
  }
}

export async function placeLogOrder(params: {
  productId: number | string
  quantity: number
  idempotencyKey: string
}): Promise<
  | { success: true; order: XpOrderData }
  | { success: false; error: string; code?: string }
> {
  if (isMockProvider()) {
    const mock = mockOrder(params)
    if (!mock.success) {
      return { success: false, error: mock.message ?? "Order failed.", code: mock.code }
    }
    return { success: true, order: mock.data! }
  }

  if (!isXclusivePlugsConfigured()) {
    return { success: false, error: "XclusivePlugs API is not configured." }
  }

  try {
    const data = await xpRequest<XpOrderResponse>("POST", "/logs/orders", {
      category_id: Number(params.productId),
      quantity: params.quantity,
      idempotency_key: params.idempotencyKey,
    })

    if (!data) {
      return { success: false, error: "Could not reach the XclusivePlugs API." }
    }
    if (!data.success) {
      return {
        success: false,
        error: data.message ?? "XclusivePlugs rejected the order.",
        code: data.code,
      }
    }
    if (!data.data) {
      return { success: false, error: "XclusivePlugs returned an empty order response." }
    }

    return { success: true, order: data.data }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logXp("placeLogOrder failed", { error: msg })
    return { success: false, error: msg }
  }
}

export function mapPlatform(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes("facebook")) return "Facebook"
  if (lower.includes("instagram")) return "Instagram"
  if (lower.includes("twitter") || lower.includes(" x")) return "Twitter/X"
  if (lower.includes("tiktok")) return "TikTok"
  if (lower.includes("youtube")) return "YouTube"
  if (lower.includes("reddit")) return "Reddit"
  if (lower.includes("telegram")) return "Telegram"
  if (lower.includes("linkedin")) return "LinkedIn"
  if (lower.includes("icloud")) return "iCloud"
  if (lower.includes("apple")) return "iCloud"
  if (lower.includes("9proxy")) return "9proxy"
  if (lower.includes("cliproxy")) return "CLIPROXY"
  if (lower.includes("hotmail")) return "Hotmail"
  if (lower.includes("outlook")) return "Outlook"
  return name
}

export function formatNaira(price: string | number | undefined): string {
  const num = Number(price) || 0
  return `₦${num.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const COUNTRY_TO_FLAG: Record<string, string> = {
  usa: "🇺🇸",
  "united states": "🇺🇸",
  america: "🇺🇸",
  indonesia: "🇮🇩",
  uk: "🇬🇧",
  "united kingdom": "🇬🇧",
  britain: "🇬🇧",
  nigeria: "🇳🇬",
  france: "🇫🇷",
  germany: "🇩🇪",
  canada: "🇨🇦",
  india: "🇮🇳",
  brazil: "🇧🇷",
  mexico: "🇲🇽",
  philippines: "🇵🇭",
  thailand: "🇹🇭",
  vietnam: "🇻🇳",
  egypt: "🇪🇬",
  saudi: "🇸🇦",
  uae: "🇦🇪",
  australia: "🇦🇺",
  japan: "🇯🇵",
  china: "🇨🇳",
  korea: "🇰🇷",
  italy: "🇮🇹",
  spain: "🇪🇸",
  poland: "🇵🇱",
  netherlands: "🇳🇱",
  sweden: "🇸🇪",
  switzerland: "🇨🇭",
  ireland: "🇮🇪",
  portugal: "🇵🇹",
  romania: "🇷🇴",
  bulgaria: "🇧🇬",
  greece: "🇬🇷",
  turkey: "🇹🇷",
  pakistan: "🇵🇰",
  bangladesh: "🇧🇩",
  sri: "🇱🇰",
  nepal: "🇳🇵",
  viet: "🇻🇳",
  cambodia: "🇰🇭",
  laos: "🇱🇦",
  myanmar: "🇲🇲",
  malaysia: "🇲🇾",
  singapore: "🇸🇬",
  indonesian: "🇮🇩",
  filipino: "🇵🇭",
  thai: "🇹🇭",
  arabia: "🇸🇦",
  emirates: "🇦🇪",
}

function hasFlagEmoji(text: string): boolean {
  if (!text) return false
  const emojiRegex = /(\p{Extended_Pictographic}|\p{Emoji_Component}|\u200d)+/u
  const match = text.match(emojiRegex)
  if (!match) return false
  const matched = match[0] ?? ""
  return /[\u{1F1E0}-\u{1F1FF}]/u.test(matched)
}

export function ensureFlagEmoji(title: string): string {
  if (!title) return title
  if (hasFlagEmoji(title)) return title
  const lower = title.toLowerCase()
  for (const [country, flag] of Object.entries(COUNTRY_TO_FLAG)) {
    if (lower.includes(country)) {
      return `${flag} ${title}`
    }
  }
  return title
}

const COUNTRY_CODE_TO_FLAG: Record<string, string> = {
  us: "🇺🇸",
  id: "🇮🇩",
  ng: "🇳🇬",
  gb: "🇬🇧",
  uk: "🇬🇧",
  fr: "🇫🇷",
  de: "🇩🇪",
  vn: "🇻🇳",
  ph: "🇵🇭",
  ca: "🇨🇦",
  in: "🇮🇳",
  br: "🇧🇷",
  mx: "🇲🇽",
  th: "🇹🇭",
  eg: "🇪🇬",
  sa: "🇸🇦",
  ae: "🇦🇪",
  au: "🇦🇺",
  jp: "🇯🇵",
  cn: "🇨🇳",
  kr: "🇰🇷",
  it: "🇮🇹",
  es: "🇪🇸",
  pl: "🇵🇱",
  nl: "🇳🇱",
  se: "🇸🇪",
  ch: "🇨🇭",
  ie: "🇮🇪",
  pt: "🇵🇹",
  ro: "🇷🇴",
  bg: "🇧🇬",
  gr: "🇬🇷",
  tr: "🇹🇷",
  pk: "🇵🇰",
  bd: "🇧🇩",
  lk: "🇱🇰",
  np: "🇳🇵",
  kh: "🇰🇭",
  la: "🇱🇦",
  mm: "🇲🇲",
  my: "🇲🇾",
  sg: "🇸🇬",
}

export function getFlagEmoji(text: string): string {
  if (!text) return ""
  const lower = text.toLowerCase()
  const twoLetter = lower.match(/\b([a-z]{2})\b/)?.[1]
  if (twoLetter && COUNTRY_CODE_TO_FLAG[twoLetter]) {
    return COUNTRY_CODE_TO_FLAG[twoLetter]
  }
  for (const [country, flag] of Object.entries(COUNTRY_TO_FLAG)) {
    if (lower.includes(country)) {
      return flag
    }
  }
  return ""
}

export function cleanTitle(title: string): string {
  if (!title) return title
  return title.replace(/^[A-Z]{2}[\s._\-|]+/, "").trim()
}

export async function fetchAllLogCategories(params?: {
  parentId?: number
  perPage?: number
}): Promise<XpLogCategory[] | null> {
  if (isMockProvider()) return MOCK_LOG_CATEGORIES

  const pageSize = Math.min(params?.perPage ?? 100, 100)
  const all: XpLogCategory[] = []

  let page = 1
  while (page <= 10) {
    try {
      const batch = await fetchLogCategories({ ...params, perPage: pageSize, page })
      if (!batch || batch.length === 0) break
      all.push(...batch)
      if (batch.length < pageSize) break
      page += 1
    } catch (error) {
      logXp("fetchAllLogCategories page failed", { page, error: error instanceof Error ? error.message : String(error) })
      break
    }
  }

  return all.length > 0 ? all : null
}