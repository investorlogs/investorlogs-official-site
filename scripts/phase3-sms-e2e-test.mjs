// Temporary Phase 3 end-to-end test (SMS verification engine via the mock
// provider). Run against a dev server on :3000 WITHOUT SMS_PROVIDER_API_KEY
// (or with SMS_PROVIDER_MOCK=true):
//   node scripts/phase3-sms-e2e-test.mjs
import "dotenv/config"
import bcrypt from "bcryptjs"
import { Client } from "pg"

const BASE = "http://localhost:3000"
const BUYER = "smsbuyer@test.local"
const BUYER2 = "smsbuyer2@test.local"
const PASSWORD = "Test1234!"
const START_BALANCE = 75000

// Mock pricing model (MOCK_BASE_PRICES × MOCK_COUNTRY_PROFILES in
// src/lib/smsProvider.ts). Prices are per-country: base USD rate × country
// multiplier × USD_TO_NGN_RATE, plus the flat profit markup.
const USD_TO_NGN_RATE = 1500
const USA_MULTIPLIER = 1.6
const MOCK_BASE_USD = { whatsapp: 0.35, telegram: 0.3, slowcode: 0.4, ratelimit: 0.3 }

const usdCost = (service) => MOCK_BASE_USD[service] * USA_MULTIPLIER
const nairaCost = (service) => Math.ceil(usdCost(service) * USD_TO_NGN_RATE * 100) / 100
const COSTS = {
  whatsapp: nairaCost("whatsapp"),
  telegram: nairaCost("telegram"),
  slowcode: nairaCost("slowcode"),
  ratelimit: nairaCost("ratelimit"),
}

// Fixed white-label profit markup, in naira (DEFAULT_PROFIT_MARKUP_NGN).
const PROFIT_MARKUP = 1000
const markupCharge = (cost) => cost + PROFIT_MARKUP

let failures = 0
function assert(cond, label, extra = "") {
  const status = cond ? "PASS" : "FAIL"
  if (!cond) failures++
  console.log(`[${status}] ${label}${extra ? " — " + extra : ""}`)
}

const money = (a, b) => Math.abs(a - b) < 1e-9

function jarFrom(response, jar) {
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(";")
    const idx = pair.indexOf("=")
    jar.set(pair.slice(0, idx), pair.slice(idx + 1))
  }
}
const cookieHeader = (jar) =>
  [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ")

async function login(email, password) {
  const jar = new Map()
  const r1 = await fetch(`${BASE}/api/auth/csrf`)
  jarFrom(r1, jar)
  const { csrfToken } = await r1.json()
  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: `${BASE}/dashboard`,
    json: "true",
  })
  const r2 = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie: cookieHeader(jar),
    },
    body,
    redirect: "manual",
  })
  jarFrom(r2, jar)
  if (![...jar.keys()].some((k) => k.includes("session-token"))) {
    throw new Error(`Login failed for ${email}`)
  }
  return cookieHeader(jar)
}

async function api(cookie, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", cookie },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => null)
  return { status: response.status, data }
}

const page = async (cookie, path) => {
  const r = await fetch(`${BASE}${path}`, { headers: { cookie } })
  const html = await r.text()
  return { status: r.status, html }
}

// ---------- DB seeding ----------
const db = new Client({ connectionString: process.env.DATABASE_URL })
await db.connect()
const genId = () => "t" + Math.random().toString(36).slice(2, 12)

// Reset previous test artifacts (idempotent re-runs)
for (const email of [BUYER, BUYER2]) {
  await db.query(
    `DELETE FROM "WalletTransaction" WHERE "userId" IN (SELECT id FROM "User" WHERE email = $1)`,
    [email]
  )
  await db.query(
    `DELETE FROM "SmsOrder" WHERE "userId" IN (SELECT id FROM "User" WHERE email = $1)`,
    [email]
  )
  await db.query(
    `INSERT INTO "User" ("id","email","password","role","walletBalance","createdAt","updatedAt")
     VALUES ($1,$2,$3,'USER',$4,now(),now())
     ON CONFLICT (email) DO UPDATE SET "password"=EXCLUDED."password", role=EXCLUDED."role", "walletBalance"=EXCLUDED."walletBalance"`,
    [genId(), email, bcrypt.hashSync(PASSWORD, 10), START_BALANCE]
  )
}

const balance = async () => {
  const r = await db.query(
    `SELECT "walletBalance" FROM "User" WHERE email = $1`,
    [BUYER]
  )
  return Number(r.rows[0].walletBalance)
}

// ---------- HTTP tests ----------
await fetch(`${BASE}/api/auth/session`).catch(() => {
  console.error("Dev server not reachable on " + BASE)
  process.exit(1)
})

const buyer = await login(BUYER, PASSWORD)
const buyer2 = await login(BUYER2, PASSWORD)

// 1) catalog
let res = await api(buyer, "/api/sms/catalog?country=usa")
assert(res.status === 200, "catalog loads (200)")
assert(
  money(res.data?.prices?.whatsapp?.price, markupCharge(COSTS.whatsapp)),
  "whatsapp 525 base -> 1525 charge (flat ₦1,000 markup)",
  JSON.stringify(res.data?.prices?.whatsapp)
)
// WHITE-LABEL: the catalog must not leak the supplier base cost or the size of
// the markup in any form.
assert(
  res.data?.prices?.whatsapp !== undefined &&
    !("cost" in res.data.prices.whatsapp) &&
    !("profit" in res.data.prices.whatsapp),
  "catalog exposes only the final price (no supplier cost)",
  JSON.stringify(res.data?.prices?.whatsapp)
)
assert(
  !("markupPercent" in (res.data ?? {})) && !("markup" in (res.data ?? {})),
  "catalog does not expose the markup percentage or amount",
  JSON.stringify(Object.keys(res.data ?? {}))
)
assert(
  !JSON.stringify(res.data ?? {}).toLowerCase().includes("5sim"),
  "catalog payload never names the upstream provider"
)

// Prices MUST differ per country — a single flat price across all countries is
// the bug this guards against.
const countryPrices = {}
for (const c of ["usa", "england", "canada", "nigeria", "germany", "india"]) {
  const r = await api(buyer, "/api/sms/catalog?country=" + c)
  countryPrices[c] = r.data?.prices?.whatsapp?.price
}
const uniquePrices = new Set(Object.values(countryPrices))
assert(
  Object.values(countryPrices).every((p) => typeof p === "number"),
  "every country returns a whatsapp price",
  JSON.stringify(countryPrices)
)
assert(
  uniquePrices.size === Object.keys(countryPrices).length,
  "whatsapp price is unique per country (not flat 1525)",
  JSON.stringify(countryPrices)
)
assert(
  !Object.values(countryPrices).some((p) => money(p, 1525)),
  "no country falls back to the old flat 1525 value",
  JSON.stringify(countryPrices)
)
// Cheaper markets must actually be cheaper than the US.
assert(
  countryPrices.india < countryPrices.usa && countryPrices.nigeria < countryPrices.usa,
  "low-cost markets price below the US",
  `usa=${countryPrices.usa} india=${countryPrices.india} nigeria=${countryPrices.nigeria}`
)
assert(
  res.data?.prices?.outofstock === undefined,
  "sentinel pseudo-services are not exposed in the public catalog"
)
res = await api(buyer, "/api/sms/catalog?country=USA")
assert(res.status === 400, "uppercase country rejected (400)")
res = await api("cookie=nope", "/api/sms/catalog?country=usa")
assert(res.status === 200, "catalog is public without a session")

// 2) order validation
res = await api(buyer, "/api/sms/order", { country: "usa", service: "NOPE!" })
assert(res.status === 400, "invalid service slug rejected (400)")
res = await api("cookie=nope", "/api/sms/order", { country: "usa", service: "whatsapp" })
assert(res.status === 401, "unauthenticated order rejected (401)")

// 3) out of stock: rejected before any debit
res = await api(buyer, "/api/sms/order", { country: "usa", service: "outofstock" })
assert(res.status === 409 && res.data?.code === "NO_STOCK", "out-of-stock rejected (409)", JSON.stringify(res.data))
assert(money(await balance(), START_BALANCE), "no debit for out-of-stock")

// 4) compensation: priced service the provider cannot ship -> debit + auto refund
res = await api(buyer, "/api/sms/order", { country: "usa", service: "noship" })
assert(res.status === 409 && res.data?.code === "NO_STOCK", "unshippable service rejected (409)", JSON.stringify(res.data))
assert(money(await balance(), START_BALANCE), "compensation refund restores the balance")

// 5) happy path: order, wait for the code, no refund
res = await api(buyer, "/api/sms/order", { country: "usa", service: "whatsapp" })
assert(res.status === 201 && res.data?.order?.status === "PENDING", "whatsapp order created (201)", JSON.stringify(res.data?.order))
const wa = res.data.order
const waCharge = markupCharge(COSTS.whatsapp)
assert(typeof wa.phoneNumber === "string" && wa.phoneNumber.length > 0, "phone number assigned", wa.phoneNumber)
assert(money(res.data.newBalance, START_BALANCE - waCharge), "wallet debited by the marked-up price", `got ${res.data.newBalance}`)
let ledger = await db.query(
  `SELECT amount, type, status FROM "WalletTransaction" WHERE reference = $1`,
  [`sms-order-${wa.id}`]
)
assert(
  ledger.rows.length === 1 && money(Number(ledger.rows[0].amount), -waCharge) && ledger.rows[0].type === "PURCHASE",
  "PURCHASE ledger entry written"
)

// Profit isolation: a separate internal SMS_PROFIT entry holds the flat ₦1,000.
let profitLedger = await db.query(
  `SELECT amount, type, status FROM "WalletTransaction" WHERE reference = $1`,
  [`sms-profit-${wa.id}`]
)
assert(
  profitLedger.rows.length === 1 &&
    money(Number(profitLedger.rows[0].amount), PROFIT_MARKUP) &&
    profitLedger.rows[0].type === "SMS_PROFIT" &&
    profitLedger.rows[0].status === "COMPLETED",
  `profit of ₦${PROFIT_MARKUP} isolated on the purchase`,
  JSON.stringify(profitLedger.rows[0])
)
// The customer-facing order must never carry the supplier cost or the margin.
assert(
  !("cost" in (wa ?? {})) && !("profit" in (wa ?? {})) && !("markup" in (wa ?? {})),
  "order payload leaks no cost/profit fields",
  JSON.stringify(Object.keys(wa ?? {}))
)

res = await api(buyer, "/api/sms/active")
assert(res.status === 200 && res.data?.order?.id === wa.id && res.data.order.status === "PENDING", "active endpoint resumes the pending order")

let received = null
for (let i = 0; i < 20 && !received; i++) {
  await new Promise((resolve) => setTimeout(resolve, 2000))
  const check = await api(buyer, `/api/sms/check-status?orderId=${wa.id}`)
  if (check.data?.order?.status === "RECEIVED") received = check.data.order
}
assert(received && /^\d{6}$/.test(received.code), "code arrives via polling", JSON.stringify(received?.code))
assert(money(await balance(), START_BALANCE - waCharge), "no refund once the code is received")

res = await api(buyer, "/api/sms/cancel", { orderId: wa.id, reason: "user" })
assert(res.status === 200 && res.data?.order?.status === "RECEIVED", "cancel after RECEIVED is a no-op", JSON.stringify(res.data?.message))
assert(money(await balance(), START_BALANCE - waCharge), "balance untouched by the late cancel")
ledger = await db.query(
  `SELECT COUNT(*)::int AS n FROM "WalletTransaction" WHERE reference = $1`,
  [`sms-refund-${wa.id}`]
)
assert(ledger.rows[0].n === 0, "no refund ledger entry for the received order")

// another user cannot touch our order
res = await api(buyer2, `/api/sms/check-status?orderId=${wa.id}`)
assert(res.status === 404, "another user cannot poll our order (404)")

// __PART3__

// 6) user cancel before code arrives: CANCELLED + refund
res = await api(buyer, "/api/sms/order", { country: "usa", service: "telegram" })
assert(
  res.status === 201 && res.data?.order?.status === "PENDING",
  "telegram order created for cancel test",
  JSON.stringify(res.data?.order)
)
const tg = res.data.order
const tgCharge = markupCharge(COSTS.telegram)
assert(
  money(res.data.newBalance, START_BALANCE - waCharge - tgCharge),
  "debited for telegram",
  `got ${res.data.newBalance}`
)
res = await api(buyer, "/api/sms/cancel", { orderId: tg.id, reason: "user" })
assert(res.status === 200, "user cancel succeeds", JSON.stringify(res.data))
assert(
  res.data?.order?.status === "CANCELLED",
  "order CANCELLED after user cancel",
  JSON.stringify(res.data?.order)
)
assert(res.data?.order?.refunded === true, "refund flag set")
assert(
  money(res.data?.order?.refundAmount, tgCharge),
  "refund amount equals charge",
  `got ${res.data?.order?.refundAmount}`
)
assert(
  money(await balance(), START_BALANCE - waCharge),
  "balance restored after cancel",
  `got ${await balance()}`
)
ledger = await db.query(
  `SELECT amount, type, status FROM "WalletTransaction" WHERE reference = $1`,
  [`sms-refund-${tg.id}`]
)
assert(
  ledger.rows.length === 1 &&
    money(Number(ledger.rows[0].amount), tgCharge) &&
    ledger.rows[0].type === "REFUND",
  "REFUND ledger entry written for user cancel"
)

// A refunded sale earned no profit → the SMS_PROFIT entry must be reversed.
profitLedger = await db.query(
  `SELECT amount, type FROM "WalletTransaction" WHERE reference = $1`,
  [`sms-profit-reversal-${tg.id}`]
)
assert(
  profitLedger.rows.length === 1 &&
    money(Number(profitLedger.rows[0].amount), -PROFIT_MARKUP) &&
    profitLedger.rows[0].type === "SMS_PROFIT",
  `profit of ₦${PROFIT_MARKUP} reversed on refund`,
  JSON.stringify(profitLedger.rows[0])
)
// Only the still-active whatsapp sale should remain profitable; the cancelled
// telegram sale must have netted out to exactly zero.
const netProfit = await db.query(
  `SELECT COALESCE(SUM(amount), 0)::float AS net FROM "WalletTransaction"
   WHERE type = 'SMS_PROFIT' AND "userId" = (SELECT id FROM "User" WHERE email = $1)`,
  [BUYER]
)
assert(
  money(netProfit.rows[0].net, PROFIT_MARKUP),
  "net SMS profit reflects only the fulfilled order",
  `got ${netProfit.rows[0].net}`
)

// 7) timeout path: slowcode never receives a code → cancel with reason "timeout"
res = await api(buyer, "/api/sms/order", { country: "usa", service: "slowcode" })
assert(
  res.status === 201 && res.data?.order?.status === "PENDING",
  "slowcode order created",
  JSON.stringify(res.data?.order)
)
const sc = res.data.order
const scCharge = markupCharge(COSTS.slowcode)
assert(
  money(res.data.newBalance, START_BALANCE - waCharge - scCharge),
  "debited for slowcode",
  `got ${res.data.newBalance}`
)

// confirm the code never arrives for slowcode
let slowcodePending = 0
for (let i = 0; i < 3; i++) {
  const chk = await api(buyer, `/api/sms/check-status?orderId=${sc.id}`)
  if (chk.data?.order?.status === "PENDING") slowcodePending++
  if (chk.data?.order?.status === "RECEIVED") break
  await new Promise((resolve) => setTimeout(resolve, 500))
}
assert(
  slowcodePending === 3,
  "slowcode stays PENDING (code never arrives)",
  `pending polls: ${slowcodePending}`
)

res = await api(buyer, "/api/sms/cancel", { orderId: sc.id, reason: "timeout" })
assert(res.status === 200, "timeout cancel succeeds", JSON.stringify(res.data))
assert(
  res.data?.order?.status === "EXPIRED",
  "slowcode order EXPIRED via timeout cancel",
  JSON.stringify(res.data?.order)
)
assert(res.data?.order?.refunded === true, "timeout refund flag set")
assert(
  money(res.data?.order?.refundAmount, scCharge),
  "timeout refund amount equals charge",
  `got ${res.data?.order?.refundAmount}`
)
assert(
  money(await balance(), START_BALANCE - waCharge),
  "balance restored after timeout cancel",
  `got ${await balance()}`
)

// 8) rate limiting: ratelimit service → poll returns 429
res = await api(buyer, "/api/sms/order", { country: "usa", service: "ratelimit" })
assert(
  res.status === 201 && res.data?.order?.status === "PENDING",
  "ratelimit order created",
  JSON.stringify(res.data?.order)
)
const rl = res.data.order
const rlCharge = markupCharge(COSTS.ratelimit)
assert(
  money(res.data.newBalance, START_BALANCE - waCharge - rlCharge),
  "debited for ratelimit",
  `got ${res.data.newBalance}`
)
res = await api(buyer, `/api/sms/check-status?orderId=${rl.id}`)
assert(
  res.status === 429 && res.data?.code === "RATE_LIMITED",
  "poll on ratelimit returns 429",
  JSON.stringify(res.data)
)
// cancel is also rate-limited — it returns 429 without refunding
res = await api(buyer, "/api/sms/cancel", { orderId: rl.id, reason: "user" })
assert(
  res.status === 429 && res.data?.code === "RATE_LIMITED",
  "cancel on ratelimit also returns 429",
  JSON.stringify(res.data)
)
// restore balance in DB — the order cannot be refunded through the API while rate-limited
await db.query(`UPDATE "User" SET "walletBalance" = $1 WHERE email = $2`, [
  START_BALANCE - waCharge,
  BUYER,
])

// 9) insufficient balance
await db.query(`UPDATE "User" SET "walletBalance" = 0.01 WHERE email = $1`, [BUYER])
res = await api(buyer, "/api/sms/order", { country: "usa", service: "whatsapp" })
assert(
  res.status === 402,
  "insufficient balance rejected (402)",
  JSON.stringify(res.data)
)
assert(
  money(await balance(), 0.01),
  "balance untouched on failed purchase",
  `got ${await balance()}`
)
await db.query(`UPDATE "User" SET "walletBalance" = $1 WHERE email = $2`, [
  START_BALANCE - waCharge,
  BUYER,
])

// 10) SMS dashboard page renders with session
let p = await page(buyer, "/dashboard/sms")
assert(
  p.status === 200 &&
    p.html.includes("Get SMS Numbers") &&
    p.html.includes("Order a virtual number"),
  "SMS dashboard page renders",
  `got ${p.status}`
)

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`)
await db.end()
process.exit(failures === 0 ? 0 : 1)