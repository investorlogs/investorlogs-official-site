import { test } from "node:test"
import assert from "node:assert/strict"
import { normalizeSmmCatalog, normalizeSmmPlatformCategory, smmRateToNgn } from "./smm-provider-catalog.ts"

test("strips the provider's server suffix so one platform stays one platform", () => {
  // The storefront groups services by `platform`. If the RSS "Server III"
  // suffix survived, every fulfilment tier would become its own group.
  assert.equal(
    normalizeSmmPlatformCategory("Instagram Followers | Server III"),
    "Instagram Followers"
  )
  assert.equal(normalizeSmmPlatformCategory("TikTok Views"), "TikTok Views")
  // A category that is only a suffix must not produce an empty platform.
  assert.equal(normalizeSmmPlatformCategory("   |   "), "Other")
  assert.equal(normalizeSmmPlatformCategory(undefined), "Other")
  // Platform aliases still win over the raw label, suffix or not.
  assert.equal(normalizeSmmPlatformCategory("IG | Server I"), "Instagram")
  assert.equal(normalizeSmmPlatformCategory("YouTube"), "YouTube")
})

test("keeps every provider service variant and leaves the provider's NGN rates untouched", () => {
  const services = normalizeSmmCatalog([
    {
      service: 903,
      name: "Instagram Followers | 99 Day Refill",
      type: "Default",
      category: "Instagram Followers | Server III",
      rate: "400.00",
      min: 10,
      max: 20000,
      refill: false,
      cancel: true,
    },
    {
      service: 1102,
      name: "Instagram Likes | Nigerian Accounts",
      type: "Default",
      category: "Instagram likes",
      rate: "12.50",
      min: 100,
      max: 50000,
      refill: true,
      cancel: false,
    },
  ])

  assert.equal(services.length, 2)
  assert.deepEqual(services[0], {
    serviceId: "903",
    platform: "Instagram Followers",
    name: "Instagram Followers | 99 Day Refill",
    serviceType: "followers",
    rate: 400,
    minQty: 10,
    maxQty: 20000,
    providerType: "Default",
    orderMode: "standard",
    supportsRefill: false,
    supportsCancel: true,
  })
  assert.equal(services[1].serviceId, "1102")
  assert.equal(services[1].platform, "Instagram likes")
  assert.equal(services[1].rate, 12.5)
  assert.equal(services[1].supportsRefill, true)
  assert.equal(services[1].supportsCancel, false)
})

test("accepts the live RSS array and keyed service payloads", () => {
  const row = {
    service: 2200,
    name: "TikTok Views | Server II",
    category: "TikTok Views",
    rate: "0.25",
    min: 100,
    max: 100000,
  }
  const fromArray = normalizeSmmCatalog([row], "NGN")
  const fromKeyedPayload = normalizeSmmCatalog({ "2200": row }, "NGN")

  assert.deepEqual(fromArray, fromKeyedPayload)
  assert.equal(fromArray[0].serviceId, "2200")
  assert.equal(fromArray[0].platform, "TikTok Views")
})

test("filters malformed entries instead of failing the whole catalog", () => {
  const services = normalizeSmmCatalog([
    null,
    { service: 1, name: "Missing price", category: "Instagram", min: 1, max: 10 },
    { id: 2, name: "Legacy Instagram Likes", category: "Instagram", rate: "0.10", min: 1, max: 10 },
  ])

  assert.equal(services.length, 1)
  assert.equal(services[0].serviceId, "2")
})

// The live RSS panel's `balance` action returns {"currency":"NGN"}, so its
// per-1000 rates are already NGN. These tests pin that contract: converting
// them again inflated every storefront price 1500x.
test("does not re-convert the live provider's NGN rates", () => {
  // Verbatim shape of RSS service 903.
  const [service] = normalizeSmmCatalog([
    {
      service: 903,
      name: "Instagram Followers | 99 Day Refill",
      type: "Default",
      rate: "2200.00",
      min: 10,
      max: 20000,
      dripfeed: false,
      refill: false,
      cancel: true,
      category: "Instagram Followers",
    },
  ])

  // NGN 2,200 per 1,000 - not NGN 3,300,000.
  assert.equal(service.rate, 2200)

  // A 1,000-unit order costs NGN 2,200 from the supplier before any markup.
  assert.equal(smmRateToNgn(2200), 2200)
})

test("converts only genuinely USD-quoted rates, and passes unknown ones through", () => {
  // FX multiplication is float, so compare with a tolerance rather than exactly.
  const closeTo = (actual: number, expected: number) =>
    assert.ok(Math.abs(actual - expected) < 1e-9, `expected ${actual} to equal ${expected}`)

  closeTo(smmRateToNgn(2.2, "USD"), 3300)
  closeTo(smmRateToNgn(2.2, "usd"), 3300)
  // NGN needs no conversion whatever the casing or symbol.
  assert.equal(smmRateToNgn(2200, "NGN"), 2200)
  assert.equal(smmRateToNgn(2200, "ngn"), 2200)
  assert.equal(smmRateToNgn(2200, "₦"), 2200)
  // An unrecognised currency must never inflate the price.
  assert.equal(smmRateToNgn(2200, "EUR"), 2200)
  assert.ok(Number.isNaN(smmRateToNgn(Number.NaN, "NGN")))
})

