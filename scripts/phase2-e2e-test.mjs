// Temporary Phase 2 end-to-end test. Run: node scripts/phase2-e2e-test.mjs
import "dotenv/config"
import bcrypt from "bcryptjs"
import { Client } from "pg"

const BASE = "http://localhost:3000"
const BUYER = "buyer2@test.local"
const BUYER3 = "buyer3@test.local"
const ADMIN = "admin2@test.local"
const PASSWORD = "Test1234!"

let failures = 0
function assert(cond, label, extra = "") {
  const status = cond ? "PASS" : "FAIL"
  if (!cond) failures++
  console.log(`[${status}] ${label}${extra ? " — " + extra : ""}`)
}

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

// ---------- DB seeding ----------
const db = new Client({ connectionString: process.env.DATABASE_URL })
await db.connect()
const genId = () => "t" + Math.random().toString(36).slice(2, 12)

// Reset previous test artifacts (idempotent re-runs)
await db.query(
  `UPDATE "DigitalAccount" SET status='AVAILABLE', "buyerId"=NULL, "purchasedAt"=NULL
   WHERE "buyerId" IN (SELECT id FROM "User" WHERE email = ANY($1))`,
  [[BUYER, BUYER3, ADMIN]]
)
await db.query(
  `DELETE FROM "WalletTransaction" WHERE "userId" IN (SELECT id FROM "User" WHERE email = ANY($1))`,
  [[BUYER, BUYER3, ADMIN]]
)
await db.query(`DELETE FROM "DigitalAccount" WHERE credentials LIKE '[TEST]%'`)

const categories = [
  { slug: "facebook", name: "Facebook", icon: "📘", desc: "Aged Facebook accounts with email access", price: 6750, count: 10 },
  { slug: "instagram", name: "Instagram", icon: "📸", desc: "Instagram accounts, verified email included", price: 9000, count: 6 },
  { slug: "twitter-x", name: "Twitter/X", icon: "🐦", desc: "Twitter/X handles with recovery mail", price: 3000, count: 4 },
  { slug: "reddit", name: "Reddit", icon: "👽", desc: "Karma-ready Reddit accounts", price: 4875, count: 3 },
]

const catIds = {}
for (const c of categories) {
  const up = await db.query(
    `INSERT INTO "AccountCategory" ("id","name","slug","description","icon","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,now(),now())
     ON CONFLICT (slug) DO UPDATE SET "name"=EXCLUDED."name", "description"=EXCLUDED."description", "icon"=EXCLUDED."icon"
     RETURNING id`,
    [genId(), c.name, c.slug, c.desc, c.icon]
  )
  catIds[c.slug] = up.rows[0].id
  for (let i = 1; i <= c.count; i++) {
    await db.query(
      `INSERT INTO "DigitalAccount" ("id","categoryId","title","price","credentials","status","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,'AVAILABLE',now(),now())`,
      [
        genId(),
        catIds[c.slug],
        `${c.name} Account ${String(i).padStart(3, "0")}`,
        c.price,
        `[TEST] ${c.slug}-user${i}@mail.com:Str0ngPass!${Math.random().toString(36).slice(2, 8)}`,
      ]
    )
  }
}

const hash = bcrypt.hashSync(PASSWORD, 10)
for (const [email, role, balance] of [
  [BUYER, "USER", 150000],
  [BUYER3, "USER", 15000],
  [ADMIN, "ADMIN", 150000],
]) {
  await db.query(
    `INSERT INTO "User" ("id","email","password","role","walletBalance","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,now(),now())
     ON CONFLICT (email) DO UPDATE SET "password"=EXCLUDED."password", role=EXCLUDED."role", "walletBalance"=EXCLUDED."walletBalance"`,
    [genId(), email, hash, role, balance]
  )
}

const state = async () => {
  const r = await db.query(
    `SELECT slug,
            count(da.id) FILTER (WHERE da.status='AVAILABLE') AS available,
            count(da.id) FILTER (WHERE da.status='SOLD') AS sold
     FROM "AccountCategory" c LEFT JOIN "DigitalAccount" da ON da."categoryId" = c.id
     GROUP BY slug`
  )
  return Object.fromEntries(r.rows.map((x) => [x.slug, x]))
}

// ---------- HTTP tests ----------
await fetch(`${BASE}/api/auth/session`).catch(() => {
  console.error("Dev server not reachable on " + BASE)
  process.exit(1)
})

const buyer = await login(BUYER, PASSWORD)
const buyer3 = await login(BUYER3, PASSWORD)
const admin = await login(ADMIN, PASSWORD)

// 1) happy path purchase: 2 x facebook @ 4.50 = 9.00 (balance 100 -> 91)
let res = await api(buyer, "/api/accounts/purchase", {
  accountCategoryId: catIds.facebook,
  quantity: 2,
})
assert(res.status === 201, "purchase 2x facebook succeeds", JSON.stringify(res.data?.order))
assert(res.data?.order?.newBalance === 136500, "balance debited to 136,500", `got ${res.data?.order?.newBalance}`)
assert(res.data?.order?.totalCost === 13500, "total cost is 13,500", `got ${res.data?.order?.totalCost}`)

// 2) validation errors
res = await api(buyer, "/api/accounts/purchase", { accountCategoryId: catIds.facebook, quantity: 0 })
assert(res.status === 400, "quantity 0 rejected (400)")
res = await api(buyer, "/api/accounts/purchase", { accountCategoryId: "does-not-exist", quantity: 1 })
assert(res.status === 404, "unknown category rejected (404)")

// 3) insufficient stock: twitter has 4 available, ask 5
res = await api(buyer, "/api/accounts/purchase", { accountCategoryId: catIds["twitter-x"], quantity: 5 })
assert(res.status === 409 && res.data?.code === "INSUFFICIENT_STOCK", "over-stock purchase rejected (409)", JSON.stringify(res.data))

// 4) insufficient balance
await db.query(`UPDATE "User" SET "walletBalance" = 15 WHERE email = $1`, [BUYER])
res = await api(buyer, "/api/accounts/purchase", { accountCategoryId: catIds.instagram, quantity: 1 })
assert(res.status === 402 && res.data?.code === "INSUFFICIENT_BALANCE", "low balance rejected (402)", JSON.stringify(res.data))
const bal = await db.query(`SELECT "walletBalance" FROM "User" WHERE email = $1`, [BUYER])
assert(Number(bal.rows[0].walletBalance) === 15, "balance untouched after failed purchase", `got ${bal.rows[0].walletBalance}`)
await db.query(`UPDATE "User" SET "walletBalance" = 150000 WHERE email = $1`, [BUYER])

// 5) race: two concurrent buyers, 4x twitter @2, qty 2 each -> both succeed on disjoint stock
const [ra, rb] = await Promise.all([
  api(buyer, "/api/accounts/purchase", { accountCategoryId: catIds["twitter-x"], quantity: 2 }),
  api(buyer3, "/api/accounts/purchase", { accountCategoryId: catIds["twitter-x"], quantity: 2 }),
])
assert(ra.status === 201 && rb.status === 201, "concurrent disjoint purchases both succeed", `a=${ra.status} b=${rb.status}`)
let st = await state()
assert(Number(st["twitter-x"].available) === 0 && Number(st["twitter-x"].sold) === 4, "all 4 twitter accounts sold exactly once", JSON.stringify(st["twitter-x"]))

// 6) race: stock now 0 -> both concurrent attempts must fail without side effects
const [rc, rd] = await Promise.all([
  api(buyer, "/api/accounts/purchase", { accountCategoryId: catIds["twitter-x"], quantity: 1 }),
  api(buyer3, "/api/accounts/purchase", { accountCategoryId: catIds["twitter-x"], quantity: 1 }),
])
assert(rc.status !== 201 && rd.status !== 201, "concurrent attempts on empty stock both fail", `a=${rc.status} b=${rd.status}`)
st = await state()
assert(Number(st["twitter-x"].sold) === 4, "sold count unchanged after failed attempts", JSON.stringify(st["twitter-x"]))

// 7) purchase for the orders page
res = await api(buyer, "/api/accounts/purchase", { accountCategoryId: catIds.instagram, quantity: 2 })
assert(res.status === 201, "purchase 2x instagram for orders page")

// 8) admin upload: 5 lines with 2 in-batch duplicates -> 3 created
const lines = [
  "[TEST] reddit-a@mail.com:pwA1",
  "[TEST] reddit-b@mail.com:pwB2",
  "[TEST] reddit-c@mail.com:pwC3",
  "[TEST] reddit-a@mail.com:pwA1",
  "[TEST] reddit-b@mail.com:pwB2",
].join("\n")
res = await api(admin, "/api/admin/accounts/upload", {
  categoryId: catIds.reddit,
  price: 4875,
  titlePrefix: "Reddit Ready",
  credentialsText: lines,
})
assert(res.status === 201 && res.data?.summary?.created === 3, "admin upload creates 3 accounts (2 dups skipped)", JSON.stringify(res.data?.summary))
res = await api(admin, "/api/admin/accounts/upload", {
  categoryId: catIds.reddit,
  price: 4875,
  credentialsText: lines,
})
assert(res.status === 201 && res.data?.summary?.created === 0 && res.data?.summary?.duplicatesInDb === 3, "re-upload skips all DB duplicates", JSON.stringify(res.data?.summary))

// 9) upload authz
res = await api(buyer, "/api/admin/accounts/upload", { categoryId: catIds.reddit, price: 1, credentialsText: "x" })
assert(res.status === 403, "non-admin upload rejected (403)")
res = await api("cookie=nope", "/api/admin/accounts/upload", { categoryId: catIds.reddit, price: 1, credentialsText: "x" })
assert(res.status === 401, "unauthenticated upload rejected (401)")

// 10) dashboard pages render with real session
const page = async (cookie, path) => {
  const r = await fetch(`${BASE}${path}`, { headers: { cookie } })
  const html = await r.text()
  return { status: r.status, html }
}
let p = await page(buyer, "/dashboard/accounts")
assert(p.status === 200 && p.html.includes("Buy Accounts") && p.html.includes("Facebook"), "store page renders with categories")
p = await page(buyer, "/dashboard/orders/accounts")
assert(p.status === 200 && p.html.includes("Purchased Accounts") && p.html.includes("Instagram Account"), "orders page renders purchased rows")
p = await page(buyer, "/dashboard/orders")
assert(p.status === 200 && p.html.includes("Order History") && p.html.includes("Wallet Transactions") && p.html.includes("PURCHASE"), "order history page renders wallet transactions")
const p2 = await fetch(`${BASE}/dashboard/accounts`, {
  headers: { cookie: "cookie=nope" },
  redirect: "manual",
})
assert(p2.status === 307 || p2.status === 302, "unauthenticated store access redirects", `got ${p2.status}`)

// 11) unauthenticated purchase
res = await api("cookie=nope", "/api/accounts/purchase", { accountCategoryId: catIds.facebook, quantity: 1 })
assert(res.status === 401, "unauthenticated purchase rejected (401)")

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`)
await db.end()
process.exit(failures === 0 ? 0 : 1)

