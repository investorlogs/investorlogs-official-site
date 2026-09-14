// Promote a user to ADMIN.
//
// Signup (src/app/api/auth/signup/route.ts) always creates role: "USER", and
// there is no in-app path to elevate a user. The admin inventory upload route
// (/api/admin/accounts/upload) requires role === "ADMIN", so the first admin has
// to be created out of band with this script.
//
// Usage:
//   node scripts/make-admin.mjs you@example.com
//
// Requires DATABASE_URL in the environment (loaded from .env).
//
// Uses `pg` directly, like the other scripts in this folder, so it runs with
// plain node and needs no TypeScript build step. (The generated Prisma client is
// TypeScript-only: src/generated/prisma/client.ts.)

import "dotenv/config"
import { Client } from "pg"

const email = process.argv[2]

if (!email) {
  console.error("Usage: node scripts/make-admin.mjs <email>")
  process.exit(1)
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error("DATABASE_URL is not set. Add it to .env before running this script.")
  process.exit(1)
}

const client = new Client({ connectionString })

try {
  await client.connect()

  const { rows } = await client.query('SELECT id, role FROM "User" WHERE email = $1', [email])

  if (rows.length === 0) {
    console.error(`No user found with email "${email}". Sign up first, then re-run.`)
    process.exit(1)
  }

  if (rows[0].role === "ADMIN") {
    console.log(`${email} is already an ADMIN. Nothing to do.`)
    process.exit(0)
  }

  await client.query('UPDATE "User" SET role = $1 WHERE email = $2', ["ADMIN", email])
  console.log(`Promoted ${email} to ADMIN.`)
  console.log("Sign out and back in — the role is baked into the JWT at login.")
} catch (error) {
  console.error("Failed to promote user:", error)
  process.exit(1)
} finally {
  await client.end().catch(() => {})
}
