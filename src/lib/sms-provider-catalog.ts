/**
 * Normalizes the public 5sim price response into one lowest in-stock operator
 * price per product. The conversion rate is supplied by the caller so this
 * module remains a pure, easily tested adapter.
 */
export function normalizeFiveSimPrices(
  payload: unknown,
  country: string,
  usdToNgnRate: number
): Record<string, number> {
  if (!payload || typeof payload !== "object") return {}
  if (!Number.isFinite(usdToNgnRate) || usdToNgnRate < 0) return {}

  const countryQuotes = (payload as Record<string, unknown>)[country]
  if (!countryQuotes || typeof countryQuotes !== "object") return {}

  const prices: Record<string, number> = {}
  for (const [product, operators] of Object.entries(
    countryQuotes as Record<string, unknown>
  )) {
    if (!operators || typeof operators !== "object") continue

    const availableCosts = Object.values(operators as Record<string, unknown>)
      .map((quote) => {
        if (!quote || typeof quote !== "object") return null
        const info = quote as { cost?: unknown; price?: unknown; count?: unknown }
        const cost = Number(info.cost ?? info.price)
        const count = Number(info.count ?? 1)
        return Number.isFinite(cost) && cost >= 0 && count > 0 ? cost : null
      })
      .filter((cost): cost is number => cost !== null)

    if (availableCosts.length > 0) {
      prices[product.toLowerCase()] = Math.min(...availableCosts) * usdToNgnRate
    }
  }
  return prices
}
