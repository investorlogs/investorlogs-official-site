/**
 * Static catalog for the SMM boosting storefront (Phase 4).
 *
 * This module is pure data - safe to import from both client and server
 * components. Provider availability/prices always come from the provider
 * layer at runtime; these lists only drive the UI selectors.
 */

export interface SmmPlatformOption {
  code: string
  name: string
  icon: string
}

export const SMM_PLATFORMS: SmmPlatformOption[] = [
  { code: "instagram", name: "Instagram", icon: "\uD83D\uDCF7" },
  { code: "tiktok", name: "TikTok", icon: "\uD83C\uDFB5" },
  { code: "youtube", name: "YouTube", icon: "\u25B6\uFE0F" },
  { code: "twitter", name: "Twitter", icon: "\uD83D\uDC26" },
  { code: "facebook", name: "Facebook", icon: "\uD83D\uDCD8" },
  { code: "telegram", name: "Telegram", icon: "\u2708\uFE0F" },
  { code: "spotify", name: "Spotify", icon: "\uD83C\uDFA7" },
  { code: "reddit", name: "Reddit", icon: "\uD83D\uDD34" },
  { code: "linkedin", name: "LinkedIn", icon: "\uD83D\uDCBC" },
  { code: "discord", name: "Discord", icon: "\uD83C\uDFAE" },
  { code: "snapchat", name: "Snapchat", icon: "\uD83D\uDC7B" },
  { code: "pinterest", name: "Pinterest", icon: "\uD83D\uDCCC" },
]

export const PLATFORM_ICON_MAP: Record<string, string> = {
  instagram: "\uD83D\uDCF7",
  tiktok: "\uD83C\uDFB5",
  youtube: "\u25B6\uFE0F",
  twitter: "\uD83D\uDC26",
  "twitter/x": "\uD83D\uDC26",
  x: "\uD83D\uDC26",
  facebook: "\uD83D\uDCD8",
  telegram: "\u2708\uFE0F",
  spotify: "\uD83C\uDFA7",
  reddit: "\uD83D\uDD34",
  linkedin: "\uD83D\uDCBC",
  discord: "\uD83C\uDFAE",
  snapchat: "\uD83D\uDC7B",
  pinterest: "\uD83D\uDCCC",
}

/**
 * Currency the SMM provider quotes its `rate` field in.
 *
 * RSS (Really Simple Social) is a Nigerian panel, and its own `balance` action
 * declares it: `{"balance":"32.38","currency":"NGN"}`. Every `rate` on the
 * `services` action is therefore already NGN per 1,000 units and must NOT be
 * converted again. Multiplying these by a USD rate inflated every storefront
 * price 1500x (a NGN 2,200/1k Instagram follower service quoted as
 * NGN 3,300,000), which no customer could ever afford.
 */
export const SMM_PROVIDER_PRICE_CURRENCY = "NGN"

/**
 * Fallback FX rate, applied only if a provider is swapped for one that quotes
 * its `rate` in USD. Unused for RSS, whose rates are natively NGN.
 */
export const USD_TO_NGN_RATE = 1500

/** Provider order shapes supported by the standard checkout flow. */
export type SmmOrderMode = "standard" | "special"

/**
 * A catalog entry in the storefront contract: NGN per 1,000 units.
 *
 * The provider quotes USD, so the conversion happens at the provider boundary
 * (see smm-provider-catalog.ts). The wallet and the database then agree on a
 * single currency from that point on.
 */
export interface SmmService {
  serviceId: string
  platform: string
  name: string
  serviceType: string
  /** Provider cost per 1,000 units, already converted to NGN. */
  rate: number
  minQty: number
  maxQty: number
  /** Original provider order type, for example Default or Custom Comments. */
  providerType: string
  /** Special provider products need inputs the standard form cannot represent. */
  orderMode: SmmOrderMode
  supportsRefill: boolean
  supportsCancel: boolean
}

/** How often the dashboard polls for SMM order progress. */
export const SMM_POLL_INTERVAL_MS = 5000