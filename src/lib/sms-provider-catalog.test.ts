import { test } from "node:test"
import assert from "node:assert/strict"
import { normalizeFiveSimPrices } from "./sms-provider-catalog.ts"

/**
 * The sentinel service codes are owned by the mock provider (see MOCK_SENTINEL_PRICES
 * in src/lib/smsProvider.ts). They must never be published to the storefront.
 */
const MOCK_SENTINELS = ["noship", "ratelimit", "slowcode", "outofstock"]

test("normalizes 5sim prices to the cheapest in-stock operator", () => {
  const prices = normalizeFiveSimPrices(
    {
      usa: {
        WhatsApp: {
          virtual1: { cost: 0.5, count: 0 },
          virtual2: { cost: 0.2, count: 12 },
        },
        Telegram: {
          virtual3: { price: "0.3", count: 4 },
        },
        Empty: {
          virtual4: { cost: 0.01, count: 0 },
        },
      },
    },
    "usa",
    1500
  )

  assert.deepEqual(prices, {
    whatsapp: 300,
    telegram: 450,
  })
})

test("ignores malformed country and quote payloads", () => {
  assert.deepEqual(normalizeFiveSimPrices(null, "usa", 1500), {})
  assert.deepEqual(normalizeFiveSimPrices({ usa: null }, "usa", 1500), {})
  assert.deepEqual(
    normalizeFiveSimPrices(
      { usa: { whatsapp: { virtual1: { cost: "not-a-number", count: 4 } } } },
      "usa",
      1500
    ),
    {}
  )
})

test("retains every priced product so the route can filter, not drop, sentinels", () => {
  // A live provider catalog should pass through unchanged. The sentinel filter
  // lives in the catalog route (SMS_MOCK_SENTINELS), so normalization itself must
  // not silently drop rows — doing so here would also hide genuine products that
  // happen to share a name with a sentinel.
  const prices = normalizeFiveSimPrices(
    {
      usa: Object.fromEntries(
        MOCK_SENTINELS.map((code) => [
          code,
          { virtual1: { cost: 0.5, count: 3 } },
        ])
      ),
    },
    "usa",
    1500
  )

  assert.deepEqual(Object.keys(prices).sort(), [...MOCK_SENTINELS].sort())
  for (const code of MOCK_SENTINELS) {
    assert.equal(prices[code], 750)
  }
})
