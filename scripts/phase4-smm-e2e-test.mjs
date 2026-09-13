// Temporary Phase 4 end-to-end test (SMM boosting engine via the mock provider).
// Run against a dev server on :3000 with SMM_PROVIDER_MOCK enabled:
//   node scripts/phase4-smm-e2e-test.mjs
import "dotenv/config"
import bcrypt from "bcryptjs"
import { Client } from "pg"

const BASE = "http://localhost:3000"
const BUYER = "smmbuyer@test.local"
const BUYER2 = "smmbuyer2@test.local"
const PASSWORD = "Test1234!"
const START_BALANCE = 75000

// Mock provider costs (rate per 1,000 units — MOCK_SMM_SERVICES in smmProvider.ts)
const RATES = {
  igFollowers: 3750,
  igLikes: 1500,
}
const MARKUP = 20
const smmCharge = (rate, quantity) => {
  const cost = rate * quantity / 1000
  const charge = cost * (1 + MARKUP / 100)
  return Math.ceil(charge * 100) / 100
}
const money = (a, b) => Math.abs(a - b) < 1e-9

let failures = 0
function assert(cond, label, extra = "") {
  const status = cond ? "PASS" : "FAIL"
  if (!cond) failures++
  console.log(`[${status}] ${label}${extra ? " — " + extra : ""}`)
}

const jarFrom = (response, jar) => {
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

const api = async (cookie, path, body) => {
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
const genId = () => "s" + Math.random().toString(36).slice(2, 12)

for (const email of [BUYER, BUYER2]) {
  await db.query(
    `DELETE FROM "WalletTransaction" WHERE "userId" IN (SELECT id FROM "User" WHERE email = $1)`,
    [email]
  )
  await db.query(
    `DELETE FROM "SmmOrder" WHERE "userId" IN (SELECT id FROM "User" WHERE email = $1)`,
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
let res = await api(buyer, "/api/smm/catalog?platform=instagram")
assert(res.status === 200, "catalog loads (200)")
assert(
  res.data?.platforms?.length === 8 &&
    res.data.platforms.some((p) => p.code === "instagram" && p.name === "Instagram"),
  "eight platforms listed (Instagram, TikTok, YouTube, Twitter, Facebook, Telegram, Spotify, Snapchat)",
  JSON.stringify(res.data?.platforms?.map((p) => p.name))
)
for (const [code, name] of [
  ["facebook", "Facebook"],
  ["telegram", "Telegram"],
  ["spotify", "Spotify"],
  ["snapchat", "Snapchat"],
]) {
  assert(
    res.data?.platforms?.some((p) => p.code === code && p.name === name),
    `${name} platform is listed`,
    JSON.stringify(res.data?.platforms?.map((p) => p.code))
  )
}
assert(
  money(res.data?.markupPercent, MARKUP),
  "markup is 20%",
  `got ${res.data?.markupPercent}`
)
const igFollowers = res.data?.services?.find((s) => s.serviceId === "ig-followers")
assert(
  igFollowers && money(igFollowers.rate, RATES.igFollowers),
  "ig-followers rate is 3750/1k",
  JSON.stringify(igFollowers)
)
assert(
  money(igFollowers?.minQty, 100) && money(igFollowers?.maxQty, 100000),
  "ig-followers min/max quantity",
  JSON.stringify(igFollowers)
)
res = await api("cookie=nope", "/api/smm/catalog?platform=instagram")
assert(res.status === 200, "catalog is public without a session")

// 2) order validation
res = await api(buyer, "/api/smm/order", { serviceId: "NOPE", targetLink: "https://instagr.am/u", quantity: 1000 })
assert(res.status === 400, "invalid service id rejected (400)")
res = await api(buyer, "/api/smm/order", { serviceId: "ig-followers", targetLink: "https://instagr.am/u", quantity: 50 })
assert(res.status === 400 && res.data?.code === "INVALID_QUANTITY", "quantity below min rejected (400)", JSON.stringify(res.data))
res = await api("cookie=nope", "/api/smm/order", { serviceId: "ig-followers", targetLink: "https://x.com/u", quantity: 1000 })
assert(res.status === 401, "unauthenticated order rejected (401)")

// 3) insufficient balance
await db.query(`UPDATE "User" SET "walletBalance" = 15 WHERE email = $1`, [BUYER])
res = await api(buyer, "/api/smm/order", { serviceId: "ig-followers", targetLink: "https://instagr.am/u", quantity: 1000 })
assert(res.status === 402, "insufficient balance rejected (402)", JSON.stringify(res.data))
assert(  money(await balance(), 15), "balance untouched on failed purchase")
await db.query(`UPDATE "User" SET "walletBalance" = $1 WHERE email = $2`, [START_BALANCE, BUYER])

// 4) happy path: order ig-followers 1,000 units
const IG_CHARGE = smmCharge(RATES.igFollowers, 1000) // 2.5 * 1.2 = 3.0
res = await api(buyer, "/api/smm/order", {
  serviceId: "ig-followers",
  targetLink: "https://instagram.com/myhandle",
  quantity: 1000,
})
assert(
  res.status === 201 && res.data?.order?.status === "PENDING",
  "smm order created (201)",
  JSON.stringify(res.data?.order)
)
const so = res.data.order
assert(money(res.data.newBalance, START_BALANCE - IG_CHARGE), "wallet debited by marked-up price", `got ${res.data.newBalance}`)
assert(so.serviceName === "Instagram Followers" && so.serviceCategory === "Instagram", "service name + category stored", JSON.stringify({ name: so.serviceName, cat: so.serviceCategory }))

// PURCHASE ledger entry
let ledger = await db.query(
  `SELECT amount, type, status FROM "WalletTransaction" WHERE reference = $1`,
  [`smm-order-${so.id}`]
)
assert(
  ledger.rows.length === 1 && money(Number(ledger.rows[0].amount), -IG_CHARGE) && ledger.rows[0].type === "PURCHASE",
  "PURCHASE ledger entry written"
)
assert(
  money(await balance(), START_BALANCE - IG_CHARGE),
  "balance matches after debit",
  `got ${await balance()}`
)

// 5) active endpoint: resume the in-flight order
res = await api(buyer, "/api/smm/active")
assert(
  res.status === 200 && res.data?.order?.id === so.id && res.data.order.status === "PENDING",
  "active endpoint resumes the in-flight order",
  JSON.stringify(res.data?.order)
)

// 6) status polling: PENDING → PROCESSING → COMPLETED
let sawProcessing = false
let sawCompleted = false
let pollCount = 0
const MAX_POLLS = 20
const POLL_INTERVAL = 2000 // 2s; mock delay is 5s (PROCESSING at 2.5s, COMPLETED at 5s)

while (pollCount < MAX_POLLS && !sawCompleted) {
  await new Promise((r) => setTimeout(r, POLL_INTERVAL))
  pollCount++
  res = await api(buyer, `/api/smm/status?orderId=${so.id}`)
  if (res.data?.order?.status === "PROCESSING" && !sawProcessing) {
    sawProcessing = true
    assert(true, "status reached PROCESSING")
  }
  if (res.data?.order?.status === "COMPLETED") {
    sawCompleted = true
  }
}
assert(sawProcessing, "status transitioned to PROCESSING", `polls: ${pollCount}`)
assert(sawCompleted, "status transitioned to COMPLETED", `polls: ${pollCount}`)
assert(money(await balance(), START_BALANCE - IG_CHARGE), "balance unchanged after completion")

// 7) another user cannot poll our order
res = await api(buyer2, `/api/smm/status?orderId=${so.id}`)
assert(res.status === 404, "another user cannot poll our smm order (404)")

// 8) dashboard pages render
let p = await page(buyer, "/dashboard/boosting")
assert(
  p.status === 200 && p.html.includes("Social Boosting") && p.html.includes("Order a social boost"),
  "boosting dashboard page renders",
  `got ${p.status}`
)
p = await page(buyer, "/dashboard/orders/boosting")
assert(
  p.status === 200 && p.html.includes("Boosting Orders"),
  "boosting orders history page renders",
  `got ${p.status}`
)

// 9) cron endpoint without secret
res = await api(buyer, "/api/cron/smm-status")
assert(res.status === 401, "cron endpoint rejects unauthenticated request (401)")

// 10) orders appear in DB
const dbOrders = await db.query(
  `SELECT id, status, "serviceId", "serviceName", "targetLink", quantity, price FROM "SmmOrder" WHERE "userId" IN (SELECT id FROM "User" WHERE email = $1)`,
  [BUYER]
)
assert(
  dbOrders.rows.length >= 1 && dbOrders.rows.some((r) => r.status === "COMPLETED"),
  "smm order persisted in DB with COMPLETED status"
)

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`)
await db.end()
process.exit(failures === 0 ? 0 : 1)
