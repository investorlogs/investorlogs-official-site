import { randomBytes, createHash } from "node:crypto"

/**
 * Email service for password resets and transactional emails.
 *
 * Provider: Resend (https://resend.com) — free tier: 100 emails/day, 3,000/mo.
 * Configure via RESEND_API_KEY and RESEND_FROM_EMAIL in your environment.
 *
 * Falls back to logging the reset link when no provider is configured, so
 * local development never blocks the flow.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim()
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL?.trim() ?? "noreply@investorplugx.com"
const NEXTAUTH_URL = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "")

export type SendResult = { ok: true } | { ok: false; error: string }

export async function sendEmail(params: {
  to: string
  subject: string
  html: string
  text?: string
}): Promise<SendResult> {
  if (!RESEND_API_KEY) {
    console.log("[email] No RESEND_API_KEY configured — skipping send to", params.to)
    return { ok: true }
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      return { ok: false, error: `Resend HTTP ${response.status}: ${body}` }
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Generate a cryptographically secure, single-use reset token.
 * The raw token is sent to the user; only the SHA-256 digest is stored.
 */
export function generateResetToken(): string {
  return randomBytes(32).toString("hex")
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function buildResetLink(token: string): string {
  return `${NEXTAUTH_URL}/auth/reset-password?token=${encodeURIComponent(token)}`
}

export function buildPasswordResetEmail(params: {
  name: string
  resetLink: string
  expiresAt: Date
}) {
  // Use a simple, widely-compatible format. toLocaleString with dateStyle/
  // timeZoneName can throw on some Node versions, and this function must never
  // crash the forgot-password flow.
  const formatted = Number.isFinite(params.expiresAt.getTime())
    ? params.expiresAt.toISOString().replace("T", " ").slice(0, 16) + " UTC"
    : "1 hour from now"

  const subject = "Reset your InvestorPlugX password"
  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="font-family: system-ui, Arial, sans-serif; background: #0B0F19; color: #e2e8f0; padding: 24px;">
    <div style="max-width: 480px; margin: 0 auto; background: #111827; border-radius: 12px; padding: 32px; border: 1px solid #1f2937;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">Reset your password</h1>
      <p style="color: #94a3b8; margin: 0 0 24px;">
        Hi ${params.name}, someone requested a password reset for your InvestorPlugX account.
        Click the button below to choose a new password.
      </p>
      <a href="${params.resetLink}" style="display: inline-block; background: #6366f1; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        Reset Password
      </a>
      <p style="color: #64748b; font-size: 12px; margin: 24px 0 0;">
        This link expires at ${formatted}. If you did not request a reset, you can safely ignore this email.
      </p>
    </div>
  </body>
</html>`

  const text = `Reset your InvestorPlugX password

Hi ${params.name},

Someone requested a password reset for your InvestorPlugX account.
Visit this link to choose a new password: ${params.resetLink}

This link expires at ${formatted}.
If you did not request a reset, you can safely ignore this email.`

  return { subject, html, text }
}

/**
 * Generate a 6-digit numeric verification code for signup email verification.
 * Cryptographically random, zero-padded (e.g. "042817").
 */
export function generateVerificationCode(): string {
  return String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, "0")
}

export function buildVerificationEmail(params: { name: string; code: string }) {
  const subject = "Your InvestorPlugX verification code"
  const html = `<div style="font-family: system-ui, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;"><h1>Verify your email</h1><p>Hi ${params.name}, your code is: <b style="font-size: 28px; letter-spacing: 6px;">${params.code}</b></p><p>Expires in 15 minutes.</p></div>`
  const text = `Hi ${params.name}, your InvestorPlugX code is: ${params.code} (expires in 15 minutes).`
  return { subject, html, text }
}
