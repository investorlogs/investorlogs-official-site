/**
 * Normalizes the SMM provider's service list into the storefront contract.
 *
 * The wallet and the database are denominated in NGN, so this module owns the
 * currency conversion. The live provider (RSS) already quotes NGN per 1,000
 * units - see `smmRateToNgn` - so the conversion is a pass-through today and
 * only becomes a real conversion if a panel that quotes in USD is substituted.
 *
 * Kept pure and separate from the authenticated HTTP adapter so the full
 * provider response can be regression-tested without exposing an API key.
 */
// The `.ts` specifier is deliberate: this module is imported by a `node --test` suite, and
// the Node ESM loader will not resolve the extensionless form.
import { SMM_PLATFORMS, SMM_PROVIDER_PRICE_CURRENCY, USD_TO_NGN_RATE, type SmmService } from "./smm-catalog.ts"

/**
 * Converts a provider `rate` into NGN, the single currency the wallet and the
 * database are denominated in.
 *
 * RSS quotes NGN per 1,000 units directly - its `balance` action returns
 * `{"balance":"...","currency":"NGN"}` - so the live path is a pass-through.
 * The USD branch only matters if the panel is ever swapped for one that quotes
 * in dollars. An unrecognised currency is passed through rather than scaled:
 * charging a customer 1500x over is a far worse failure than losing on FX.
 */
export function smmRateToNgn(rate: number, currency: string = SMM_PROVIDER_PRICE_CURRENCY): number {
  if (!Number.isFinite(rate)) return Number.NaN

  const code = currency.trim().toUpperCase()
  if (code === "USD" || code === "$" || code === "US DOLLAR") return rate * USD_TO_NGN_RATE
  return rate
}

export interface SmmV2Service {
  /** Current RSS API field. `id` is accepted for compatibility with older panels. */
  service?: number | string
  id?: number | string
  name?: string
  type?: string
  category?: string
  rate?: number | string
  min?: number | string
  max?: number | string
  refill?: boolean
  cancel?: boolean
}

/**
 * Provider order types that need inputs the standard checkout form cannot
 * express (e.g. the comments a "Custom Comments" service expects).
 */
const SPECIAL_ORDER_TYPES = ["custom comment", "comment like", "poll", "subscription"]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function inferServiceType(name: string, providerType: string): string {
  const value = `${name} ${providerType}`.toLowerCase()
  if (value.includes("comment")) return "comments"
  if (value.includes("retweet") || value.includes("repost") || value.includes("share")) return "shares"
  if (value.includes("save")) return "saves"
  if (value.includes("impression") || value.includes("reach")) return "impressions"
  if (value.includes("view") || value.includes("play")) return "views"
  if (value.includes("like")) return "likes"
  if (value.includes("subscriber") || value.includes("channel") || value.includes("member")) return "subscribers"
  if (value.includes("follower")) return "followers"
  return "other"
}

function isSpecialOrderType(providerType: string): boolean {
  const normalized = providerType.toLowerCase()
  return SPECIAL_ORDER_TYPES.some((type) => normalized.includes(type))
}

/** Normalizes both a raw service list and the provider's keyed response shape. */
export function normalizeSmmCatalog(
  payload: unknown,
  priceCurrency: string = SMM_PROVIDER_PRICE_CURRENCY
): SmmService[] {
  if (!Array.isArray(payload) && !isRecord(payload)) return []

  const rows = Array.isArray(payload) ? payload : Object.values(payload)

  return rows
    .filter(isRecord)
    .map((row): SmmService | null => {
      const serviceId = String(row.service ?? row.id ?? "").trim()
      const name = typeof row.name === "string" ? row.name.trim() : ""
      const category = typeof row.category === "string" ? row.category.trim() : ""
      const providerType = typeof row.type === "string" && row.type.trim() ? row.type.trim() : "Default"
      const rate = Number(row.rate)
      const minQty = Number(row.min)
      const maxQty = Number(row.max)

      return {
        serviceId,
        platform: normalizeSmmPlatformCategory(category),
        name: name || `${providerType} service`,
        serviceType: inferServiceType(name, providerType),
        rate: smmRateToNgn(rate, priceCurrency),
        minQty,
        maxQty,
        providerType,
        orderMode: isSpecialOrderType(providerType) ? "special" : "standard",
        supportsRefill: row.refill === true,
        // The panel omits `cancel` on some services; treat absence as supported
        // so we do not hide the cancel action the provider will actually honour.
        supportsCancel: row.cancel !== false,
      }
    })
    .filter((service): service is SmmService => {
      if (!service) return false
      return (
        service.serviceId.length > 0 &&
        service.platform.length > 0 &&
        Number.isFinite(service.rate) &&
        service.rate > 0 &&
        Number.isInteger(service.minQty) &&
        service.minQty > 0 &&
        Number.isInteger(service.maxQty) &&
        service.maxQty >= service.minQty
      )
    })
}

/** Normalizes RSS's category labels to the platform labels used by the UI. */
export function normalizeSmmPlatformCategory(category: string | null | undefined): string {
  if (!category) return "Other"

  // RSS suffixes the category with the fulfilment tier, e.g.
  // "Instagram Followers | Server III". That suffix is a provider implementation
  // detail, not a platform, so it is dropped before any matching. Keeping it
  // would turn every server variant into its own entry in the storefront's
  // platform selector and miss the icon lookup entirely.
  const [base] = category.split("|")
  const trimmed = (base ?? "").trim()
  if (!trimmed) return "Other"

  const lower = trimmed.toLowerCase().replace(/[\s/_-]+/g, "")
  const aliases: Record<string, string> = {
    meta: "Facebook",
    fb: "Facebook",
    facebookpage: "Facebook",
    x: "Twitter",
    twitterx: "Twitter",
    tiktokx: "Twitter",
    snap: "Snapchat",
    snapchatstory: "Snapchat",
    ig: "Instagram",
    insta: "Instagram",
    yt: "YouTube",
    youtube: "YouTube",
  }
  if (lower in aliases) return aliases[lower]
  for (const platform of SMM_PLATFORMS) {
    if (lower === platform.name.toLowerCase().replace(/\s+/g, "")) return platform.name
  }
  return trimmed
}