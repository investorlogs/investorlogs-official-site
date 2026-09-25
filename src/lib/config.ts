import { isTransientDbError, prisma, withDbRetry } from "@/lib/prisma"

/**
 * Lightweight key/value configuration store (Phase 5).
 *
 * Admin-adjustable settings like markup percentages are persisted here and
 * read with environment-variable fallbacks so the system works out of the box
 * in development without any DB rows.
 */

const CONFIG_CACHE_TTL_MS = 5000
const cache = new Map<string, { value: string; expires: number }>()

export async function getConfig(key: string, defaultValue: string): Promise<string> {
  const cached = cache.get(key)
  if (cached && Date.now() < cached.expires) {
    return cached.value
  }

  const envFallback = process.env[key] ?? defaultValue

  let row: { value: string } | null = null
  try {
    row = await withDbRetry(() => prisma.config.findUnique({ where: { key } }))
  } catch (error) {
    // These settings are advisory (markup percentages, feature flags) and the
    // contract of this helper is that they fall back to the environment. A
    // transient connection failure should not take down the whole page, so log
    // it and serve the fallback. Non-transient errors (bad schema, missing
    // table) still propagate, because those indicate a real misconfiguration.
    if (!isTransientDbError(error)) throw error
    console.warn(`[config] "${key}" unavailable, using environment fallback:`, error)
  }

  if (row) {
    cache.set(key, { value: row.value, expires: Date.now() + CONFIG_CACHE_TTL_MS })
    return row.value
  }

  cache.set(key, { value: envFallback, expires: Date.now() + CONFIG_CACHE_TTL_MS })
  return envFallback
}

export async function getConfigNumber(key: string, defaultValue: number): Promise<number> {
  const value = await getConfig(key, String(defaultValue))
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : defaultValue
}

export async function setConfig(key: string, value: string): Promise<void> {
  await prisma.config.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
  cache.delete(key)
}
