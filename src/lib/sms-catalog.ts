/**
 * Static catalog for the SMS verification storefront (Phase 3).
 *
 * This module is pure data — safe to import from both client and server
 * components. Provider availability/prices always come from the provider
 * layer at runtime; these lists only drive the UI selectors.
 *
 * Codes follow the 5sim slugs (the integrated provider), e.g. `england` is
 * the UK and `nigeria` is NG.
 */

export interface SmsCountryOption {
  code: string
  name: string
  flag: string
}

export interface SmsServiceOption {
  code: string
  name: string
  icon: string
}

export const SMS_COUNTRIES: SmsCountryOption[] = [
  { code: "usa", name: "USA", flag: "🇺🇸" },
  { code: "england", name: "UK", flag: "🇬🇧" },
  { code: "canada", name: "Canada", flag: "🇨🇦" },
  { code: "nigeria", name: "Nigeria (NG)", flag: "🇳🇬" },
  { code: "germany", name: "Germany", flag: "🇩🇪" },
  { code: "france", name: "France", flag: "🇫🇷" },
  { code: "philippines", name: "Philippines", flag: "🇵🇭" },
  { code: "india", name: "India", flag: "🇮🇳" },
]

export const SMS_SERVICES: SmsServiceOption[] = [
  { code: "whatsapp", name: "WhatsApp", icon: "💬" },
  { code: "telegram", name: "Telegram", icon: "✈️" },
  { code: "google", name: "Google", icon: "🔎" },
  { code: "facebook", name: "Facebook", icon: "📘" },
  { code: "instagram", name: "Instagram", icon: "📸" },
]

export const PRODUCT_CODE_MAP: Record<string, { name: string; icon: string }> = {
  whatsapp: { name: "WhatsApp", icon: "💬" },
  telegram: { name: "Telegram", icon: "✈️" },
  google: { name: "Google", icon: "🔎" },
  facebook: { name: "Facebook", icon: "📘" },
  instagram: { name: "Instagram", icon: "📸" },
  twitter: { name: "Twitter / X", icon: "🐦" },
  x: { name: "Twitter / X", icon: "🐦" },
  openai: { name: "OpenAI / ChatGPT", icon: "🤖" },
  chatgpt: { name: "OpenAI / ChatGPT", icon: "🤖" },
  steam: { name: "Steam", icon: "🎮" },
  uber: { name: "Uber", icon: "🚗" },
  paypal: { name: "PayPal", icon: "💳" },
  signal: { name: "Signal", icon: "🔐" },
  tinder: { name: "Tinder", icon: "🔥" },
  snapchat: { name: "Snapchat", icon: "👻" },
  linkedin: { name: "LinkedIn", icon: "💼" },
  microsoft: { name: "Microsoft", icon: "🪟" },
  apple: { name: "Apple", icon: "🍎" },
  amazon: { name: "Amazon", icon: "📦" },
  discord: { name: "Discord", icon: "🎧" },
  viber: { name: "Viber", icon: "📞" },
  line: { name: "LINE", icon: "💚" },
  wechat: { name: "WeChat", icon: "💬" },
  zoom: { name: "Zoom", icon: "📹" },
  skype: { name: "Skype", icon: "💬" },
  yahoo: { name: "Yahoo", icon: "🟣" },
  yandex: { name: "Yandex", icon: "🔍" },
  mailru: { name: "Mail.ru", icon: "📧" },
  rambler: { name: "Rambler", icon: "📧" },
  olx: { name: "OLX", icon: "🛒" },
  spotify: { name: "Spotify", icon: "🎵" },
  netflix: { name: "Netflix", icon: "🎬" },
  twitch: { name: "Twitch", icon: "📺" },
  reddit: { name: "Reddit", icon: "🤖" },
  pinterest: { name: "Pinterest", icon: "📌" },
  tiktok: { name: "TikTok", icon: "🎵" },
  youtube: { name: "YouTube", icon: "▶️" },
  github: { name: "GitHub", icon: "🐙" },
  gitlab: { name: "GitLab", icon: "🦊" },
  bitbucket: { name: "Bitbucket", icon: "🪣" },
  wordpress: { name: "WordPress", icon: "📝" },
  blogger: { name: "Blogger", icon: "📝" },
  medium: { name: "Medium", icon: "📝" },
  quora: { name: "Quora", icon: "❓" },
  airbnb: { name: "Airbnb", icon: "🏠" },
  booking: { name: "Booking.com", icon: "🏨" },
  coinbase: { name: "Coinbase", icon: "₿" },
  binance: { name: "Binance", icon: "🟡" },
  kraken: { name: "Kraken", icon: "🐙" },
  patreon: { name: "Patreon", icon: "❤️" },
  onlyfans: { name: "OnlyFans", icon: "🔞" },
  chime: { name: "Chime", icon: "🏦" },
  wise: { name: "Wise", icon: "💱" },
  revolut: { name: "Revolut", icon: "💳" },
  venmo: { name: "Venmo", icon: "💸" },
  cashapp: { name: "Cash App", icon: "💵" },
  adidas: { name: "Adidas", icon: "👟" },
  nike: { name: "Nike", icon: "👟" },
  ebay: { name: "eBay", icon: "🛒" },
  aliexpress: { name: "AliExpress", icon: "📦" },
}

export function resolveService(code: string): { name: string; icon: string } {
  const key = code.toLowerCase()
  return PRODUCT_CODE_MAP[key] ?? { name: code, icon: "🔌" }
}

export function resolveServiceOption(code: string): SmsServiceOption {
  const { name, icon } = resolveService(code)
  return { code, name, icon }
}

/** How long a rented number stays active before it expires (15 minutes). */
export const SMS_ORDER_TTL_MS = 15 * 60 * 1000

/** How often the dashboard polls for an incoming SMS code. */
export const SMS_POLL_INTERVAL_MS = 4000

/** Fixed USD → NGN rate for quoting provider costs in local currency. */
export const USD_TO_NGN_RATE = 1500
