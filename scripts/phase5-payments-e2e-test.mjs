// Temporary Phase 5 end-to-end test (Wallet & payments via the mock provider).
// Run against a dev server on :3000 WITHOUT PAYSTACK_SECRET_KEY
// (or with PAYMENT_PROVIDER_MOCK=true):
//   node scripts/phase5-payments-e2e-test.mjs
import "dotenv/config"
import bcrypt from "bcryptjs"
import { Client } from "pg"

const BASE = "http://localhost:3000"
const BUYER = "walletbuyer@test.local"
const PASSWORD = "Test1234!"
const START_BALANCE = 5000
const DEPOSIT_AMOUNT = 10000

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
    callbackUrl: `${BASE}/dashboard/wallet`,
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
  return { status: r.status, html: await r.text() }
}

// ---------- DB seeding ----------
const db = new Client({ connectionString: process.env.DATABASE_URL })
await db.connect()
const genId = () => "w" + Math.random().toString(36).slice(2, 12)

// Reset previous test artifacts (idempotent re-runs)
await db.query(
  `DELETE FROM "WalletTransaction" WHERE "userId" IN (SELECT id FROM "User" WHERE email = $1)`,
  [BUYER]
)
await db.query(
  `INSERT INTO "User" ("id","email","password","role","walletBalance","createdAt","updatedAt")
   VALUES ($1,$2,$3,'USER',$4,now(),now())
   ON CONFLICT (email) DO UPDATE SET "password"=EXCLUDED."password", role=EXCLUDED."role", "walletBalance"=EXCLUDED."walletBalance"`,
  [genId(), BUYER, bcrypt.hashSync(PASSWORD, 10), START_BALANCE]
)

const balance = async () => {
  const r = await db.query(
    `SELECT "walletBalance" FROM "User" WHERE email = $1`,
    [BUYER]
  )
  return Number(r.rows[0].walletBalance)
}

const txByReference = async (ref) => {
  const r = await db.query(
    `SELECT id, amount, type, status, "userId" FROM "WalletTransaction" WHERE reference = $1`,
    [ref]
  )
  return r.rows[0]
}

// ---------- HTTP tests ----------
await fetch(`${BASE}/api/auth/session`).catch(() => {
  console.error("Dev server not reachable on " + BASE)
  process.exit(1)
})

const buyer = await login(BUYER, PASSWORD)

// 1) initialize deposit (mock mode → no real gateway needed)
let res = await api(buyer, "/api/payments/initialize", {
  amount: DEPOSIT_AMOUNT,
  method: "card_paystack",
})
assert(
  res.status === 200 && typeof res.data?.reference === "string",
  "initialize POST returns 200 + reference",
  JSON.stringify(res.data)
)
assert(
  typeof res.data?.authorizationUrl === "string" && res.data.authorizationUrl.includes("mockcheckout"),
  "mock mode returns mockcheckout authorizationUrl",
  res.data?.authorizationUrl
)
assert(
  money(res.data?.amount, DEPOSIT_AMOUNT),
  "returned amount matches request"
)
const depositRef = res.data.reference

// 2) DEPOSIT transaction created as PENDING with correct amount
const pendingTx = await txByReference(depositRef)
assert(
  pendingTx && pendingTx.type === "DEPOSIT" && pendingTx.status === "PENDING",
  "WalletTransaction DEPOSIT/PENDING created",
  JSON.stringify(pendingTx)
)
assert(money(Number(pendingTx.amount), DEPOSIT_AMOUNT), "pending tx amount matches")

// balance unchanged (still PENDING — not yet credited)
assert(
  money(await balance(), START_BALANCE),
  "balance unchanged while deposit is PENDING",
  `got ${await balance()}`
)

// 3) simulate webhook confirmation through the mock-confirm endpoint
res = await api(buyer, "/api/payments/mock-confirm", { reference: depositRef })
assert(
  res.status === 200 && res.data?.status === "COMPLETED",
  "mock-confirm returns 200 + COMPLETED",
  JSON.stringify(res.data)
)

// 4) balance credited
assert(
  money(await balance(), START_BALANCE + DEPOSIT_AMOUNT),
  "balance credited after confirmation",
  `got ${await balance()}`
)

// 5) transaction status updated to COMPLETED at DB level
const doneTx = await txByReference(depositRef)
assert(
  doneTx.status === "COMPLETED",
  "WalletTransaction status COMPLETED at DB level",
  doneTx.status
)

// 6) re-confirm is idempotent (409 already processed)
res = await api(buyer, "/api/payments/mock-confirm", { reference: depositRef })
assert(
  res.status === 409 && res.data?.code === "ALREADY_PROCESSED",
  "re-confirm rejected as already processed (409)",
  JSON.stringify(res.data)
)

// 7) another user cannot confirm our deposit (403)
await db.query(
  `INSERT INTO "User" ("id","email","password","role","walletBalance","createdAt","updatedAt")
   VALUES ($1,'otherbuyer@test.local',$2,'USER',1000,now(),now())
   ON CONFLICT (email) DO NOTHING`,
  [genId(), bcrypt.hashSync(PASSWORD, 10)]
)
const buyer2 = await login("otherbuyer@test.local", PASSWORD)
res = await api(buyer2, "/api/payments/mock-confirm", { reference: depositRef })
assert(
  res.status === 403,
  "another user cannot confirm a deposit they don't own (403)",
  JSON.stringify(res.data)
)

// 8) status endpoint shows the deposit
res = await api(buyer, "/api/payments/status")
assert(res.status === 200, "status endpoint returns 200")
assert(
  money(res.data.walletBalance, START_BALANCE + DEPOSIT_AMOUNT),
  "status endpoint returns correct balance",
  `got ${res.data.walletBalance}`
)
const txInList = res.data.transactions?.some((t) => t.reference === depositRef)
assert(txInList, "status endpoint includes the deposit in transactions")
const completedInList = res.data.transactions?.some(
  (t) => t.reference === depositRef && t.status === "COMPLETED"
)
assert(completedInList, "status endpoint shows COMPLETED status")

// 9) validation: negative amount rejected
res = await api(buyer, "/api/payments/initialize", { amount: -5, method: "card_paystack" })
assert(
  res.status === 400,
  "negative amount rejected (400)",
  JSON.stringify(res.data)
)

// 10) wallet page renders with session
let p = await page(buyer, "/dashboard/wallet")
assert(
  p.status === 200 &&
    p.html.includes("Deposit") &&
    p.html.includes("₦" + (START_BALANCE + DEPOSIT_AMOUNT).toFixed(2)),
  "wallet page renders with updated balance"
)

// 11) mock checkout page renders
p = await page(buyer, `/payments/mockcheckout?ref=${depositRef}&amount=${DEPOSIT_AMOUNT.toFixed(2)}`)
assert(p.status === 200 && p.html.includes("Mock Payment"), "mock checkout page renders")

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`)
await db.end()
process.exit(failures === 0 ? 0 : 1)
