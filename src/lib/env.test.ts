import { test } from "node:test"
import assert from "node:assert/strict"
import { parseEnv } from "./env.ts"

/**
 * Tests for the environment schema (src/lib/env.ts).
 *
 * parseEnv() is exercised directly with synthetic sources so these assertions
 * never read or mutate the real process.env.
 */

/** A minimal source satisfying every required key. */
function validSource(): Record<string, string | undefined> {
  return {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db?schema=public",
    NEXTAUTH_SECRET: "a-real-secret",
    NEXTAUTH_URL: "http://localhost:3000",
  }
}

test("accepts a source with all required keys present", () => {
  const env = parseEnv(validSource())

  assert.equal(env.DATABASE_URL, "postgresql://user:pass@localhost:5432/db?schema=public")
  assert.equal(env.NEXTAUTH_SECRET, "a-real-secret")
  assert.equal(env.NEXTAUTH_URL, "http://localhost:3000")
})

test("tolerates missing optional keys", () => {
  const env = parseEnv(validSource())

  // Optional keys are simply absent, not an error.
  assert.equal(env.PAYSTACK_SECRET_KEY, undefined)
  assert.equal(env.RESEND_API_KEY, undefined)
  assert.equal(env.OPENAI_API_KEY, undefined)
  assert.equal(env.CRON_SECRET, undefined)
  assert.equal(env.SMS_PROVIDER_API_KEY, undefined)
})

test("treats blank optional values as undefined", () => {
  const env = parseEnv({
    ...validSource(),
    PAYSTACK_SECRET_KEY: "",
    RESEND_API_KEY: "   ",
  })

  assert.equal(env.PAYSTACK_SECRET_KEY, undefined)
  assert.equal(env.RESEND_API_KEY, undefined)
})

test("treats mock flags as false unless the literal string 'true'", () => {
  const off = parseEnv(validSource())
  assert.equal(off.PAYMENT_PROVIDER_MOCK, false)
  assert.equal(off.SMS_PROVIDER_MOCK, false)
  assert.equal(off.SMM_PROVIDER_MOCK, false)

  const on = parseEnv({
    ...validSource(),
    PAYMENT_PROVIDER_MOCK: "true",
    SMS_PROVIDER_MOCK: "true",
  })
  assert.equal(on.PAYMENT_PROVIDER_MOCK, true)
  assert.equal(on.SMS_PROVIDER_MOCK, true)
  // "1" / "TRUE" are not treated as enabled, matching the provider helpers.
  assert.equal(parseEnv({ ...validSource(), SMM_PROVIDER_MOCK: "1" }).SMM_PROVIDER_MOCK, false)
})

test("throws when DATABASE_URL is missing", () => {
  const source = validSource()
  delete source.DATABASE_URL

  assert.throws(() => parseEnv(source), /DATABASE_URL/)
})

test("throws when NEXTAUTH_SECRET is missing", () => {
  const source = validSource()
  delete source.NEXTAUTH_SECRET

  assert.throws(() => parseEnv(source), /NEXTAUTH_SECRET/)
})

test("throws when NEXTAUTH_URL is missing", () => {
  const source = validSource()
  delete source.NEXTAUTH_URL

  assert.throws(() => parseEnv(source), /NEXTAUTH_URL/)
})

test("throws on an empty required value", () => {
  assert.throws(
    () => parseEnv({ ...validSource(), DATABASE_URL: "" }),
    /DATABASE_URL must not be empty/
  )
})

test("throws when a required key still holds an .env.example placeholder", () => {
  assert.throws(
    () => parseEnv({ ...validSource(), NEXTAUTH_SECRET: "your-secret-key-here" }),
    /placeholder/
  )
})

test("reports every problem at once, not just the first", () => {
  assert.throws(() => parseEnv({}), (error: Error) => {
    assert.match(error.message, /DATABASE_URL/)
    assert.match(error.message, /NEXTAUTH_SECRET/)
    assert.match(error.message, /NEXTAUTH_URL/)
    return true
  })
})

test("coerces SMM_MARKUP_PERCENT to a number when supplied", () => {
  assert.equal(parseEnv({ ...validSource(), SMM_MARKUP_PERCENT: "20" }).SMM_MARKUP_PERCENT, 20)
  assert.equal(parseEnv(validSource()).SMM_MARKUP_PERCENT, undefined)
})