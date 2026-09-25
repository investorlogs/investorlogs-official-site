import { test } from "node:test"
import assert from "node:assert/strict"
import {
  amountsMatch,
  extractGatewayAmount,
  extractGatewayStatus,
  extractReference,
  isPlausibleReference,
  koboToNaira,
  MAX_REFERENCE_LENGTH,
  normalizeProviderStatus,
  shouldEnforceAmount,
} from "./deposit-settlement.ts"

/**
 * Tests for the pure deposit-settlement rules (src/lib/deposit-settlement.ts).
 *
 * These are the rules that decide whether a real payment becomes real wallet
 * balance, on both the webhook and the post-checkout callback. Several of the
 * assertions below are regressions against specific defects that let customers
 * pay without being credited.
 */

test('treats Paystack "success" as a success', () => {
  // This is the exact value a real charge.success webhook carries. The old
  // webhook only matched "successful", so genuine successful payments were
  // normalised to PENDING and never credited.
  assert.equal(normalizeProviderStatus("success"), "success")
})

test('also accepts the other success spellings Paystack uses', () => {
  for (const raw of ["successful", "succeeded", "Success", " SUCCESS ", "completed"]) {
    assert.equal(normalizeProviderStatus(raw), "success", raw)
  }
})

test('maps every failure and abandonment spelling to failed', () => {
  for (const raw of ["failed", "failure", "abandoned", "cancelled", "canceled", "reversed"]) {
    assert.equal(normalizeProviderStatus(raw), "failed", raw)
  }
})

test('never defaults a missing or unknown status to success', () => {
  // Regression: the webhook used to do `?? "success"`, which meant a malformed
  // or unexpected event credited a wallet for a payment that never happened.
  for (const raw of [undefined, null, "", "  ", "ongoing", "queued", 42, {}, []]) {
    assert.equal(normalizeProviderStatus(raw), "pending", String(raw))
  }
})

test('converts kobo to naira', () => {
  assert.equal(koboToNaira(100000), 1000)
  assert.equal(koboToNaira("250000"), 2500)
  assert.equal(koboToNaira(1), 0.01)
})

test('rejects unusable kobo values rather than coercing them to 0', () => {
  // 0 would silently mean "paid nothing", which is indistinguishable from a
  // free credit, so it is rejected as a missing amount instead.
  for (const raw of [undefined, null, "abc", NaN, Infinity, -100, {}]) {
    assert.equal(koboToNaira(raw), null, String(raw))
  }
})

test('compares amounts without floating point drift', () => {
  assert.ok(amountsMatch(1000, 1000))
  assert.ok(amountsMatch(0.1 + 0.2, 0.3))
  assert.ok(amountsMatch(2500, 2500.004))
  assert.ok(!amountsMatch(1000, 999.99))
  assert.ok(!amountsMatch(1000, 1000.01))
})

test('enforces a reported amount but tolerates an absent one', () => {
  // A gateway that omits the amount must not block every payment...
  assert.equal(shouldEnforceAmount(null), false)
  assert.equal(shouldEnforceAmount(0), false)
  // ...but one that reports a real amount must be checked.
  assert.equal(shouldEnforceAmount(1), true)
  assert.equal(shouldEnforceAmount(5000), true)
})

test('rejects empty and absurdly long references', () => {
  assert.ok(isPlausibleReference("paystack-1700000000-ab12cd34"))
  assert.ok(!isPlausibleReference(""))
  assert.ok(!isPlausibleReference(undefined))
  assert.ok(!isPlausibleReference(null))
  assert.ok(!isPlausibleReference(12345))
  assert.ok(!isPlausibleReference("a".repeat(MAX_REFERENCE_LENGTH + 1)))
  assert.ok(isPlausibleReference("a".repeat(MAX_REFERENCE_LENGTH)))
})

test('reads the reference from the nested webhook envelope', () => {
  const payload = { event: "charge.success", data: { reference: "paystack-abc" } }
  assert.equal(extractReference(payload), "paystack-abc")
})

test('reads a top-level reference from the mock provider', () => {
  assert.equal(extractReference({ reference: "mockpay-abc" }), "mockpay-abc")
})

test('returns null when no usable reference is present', () => {
  assert.equal(extractReference({}), null)
  assert.equal(extractReference({ data: { reference: "" } }), null)
  assert.equal(extractReference(null), null)
  assert.equal(extractReference("nope"), null)
})

test('reads the paid amount out of a charge.success envelope', () => {
  const payload = { data: { reference: "paystack-abc", amount: 500000, status: "success" } }
  assert.equal(extractGatewayAmount(payload), 5000)
  assert.equal(extractGatewayStatus(payload), "success")
})

test('settles nothing when a gateway event omits both status and amount', () => {
  const payload = { data: { reference: "paystack-abc" } }
  assert.equal(extractGatewayStatus(payload), "pending")
  assert.equal(extractGatewayAmount(payload), null)
})
