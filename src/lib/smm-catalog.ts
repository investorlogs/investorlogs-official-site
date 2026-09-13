/**
 * Static catalog for the SMM boosting storefront (Phase 4).
 *
 * This module is pure data — safe to import from both client and server
 * components. Provider availability/prices always come from the provider
 * layer at runtime; these lists only drive the UI selectors.
 *
 * Codes follow the 5sim slugs (the integrated provider), e.g. `england` is
 * the UK and `nigeria` is NG.
 */

export interface SmmPlatformOption {
  code: string
  name: string
  icon: string
}

export const SMM_PLATFORMS: SmmPlatformOption[] = [
  { code: "instagram", name: "Instagram", icon: "📷" },
  { code: "tiktok", name: "TikTok", icon: "🎵" },
  { code: "youtube", name: "YouTube", icon: "▶️" },
  { code: "twitter", name: "Twitter", icon: "🐦" },
  { code: "facebook", name: "Facebook", icon: "📘" },
  { code: "telegram", name: "Telegram", icon: "✈️" },
  { code: "spotify", name: "Spotify", icon: "🎧" },
  { code: "reddit", name: "Reddit", icon: "🔴" },
  { code: "linkedin", name: "LinkedIn", icon: "💼" },
  { code: "discord", name: "Discord", icon: "🎮" },
  { code: "snapchat", name: "Snapchat", icon: "👻" },
  { code: "pinterest", name: "Pinterest", icon: "📌" },
]

export const PLATFORM_ICON_MAP: Record<string, string> = {
  instagram: "📷",
  tiktok: "🎵",
  youtube: "▶️",
  twitter: "🐦",
  "twitter/x": "🐦",
  x: "🐦",
  facebook: "📘",
  telegram: "✈️",
  spotify: "🎧",
  reddit: "🔴",
  linkedin: "💼",
  discord: "🎮",
  snapchat: "👻",
  pinterest: "📌",
}

/** Rate is the provider cost per 1,000 units, quoted in NGN before markup. */
export interface SmmService {
  serviceId: string
  platform: string
  name: string
  serviceType: "followers" | "likes" | "views" | "subscribers" | "retweets"
  rate: number
  minQty: number
  maxQty: number
}

/** Fixed USD → NGN rate for quoting provider costs in local currency. */
export const USD_TO_NGN_RATE = 1500

/**
 * How often the dashboard polls for an incoming SMS code.
 */
export const SMM_POLL_INTERVAL_MS = 5000
