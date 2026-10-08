import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSession } from "@/lib/session"
import { sendEmail } from "@/lib/email"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const testEmailSchema = z.object({ to: z.string().email() })

/**
 * Admin-only email diagnostic.
 *
 * Unlike the forgot-password flow (which always returns generic success to
 * avoid user enumeration), this endpoint returns the REAL Resend result so
 * an admin can see the exact failure in the browser instead of digging
 * through Vercel runtime logs.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: admin access required" },
        { status: 403 }
      )
    }

    const { to } = testEmailSchema.parse(await request.json())

    const hasKey = !!process.env.RESEND_API_KEY?.trim()
    const fromEmail =
      process.env.RESEND_FROM_EMAIL?.trim() ?? "noreply@investorplugx.com"
    const nextAuthUrl = (process.env.NEXTAUTH_URL ?? "").replace(/\/+$/, "")

    if (!hasKey) {
      return NextResponse.json({
        ok: false,
        diagnosis: "RESEND_API_KEY is missing in this environment.",
        env: {
          resendApiKeySet: false,
          resendFromEmail: fromEmail,
          nextAuthUrl: nextAuthUrl || "(missing — reset links default to localhost)",
        },
        hint: "Add RESEND_API_KEY to Vercel Production env vars, then Redeploy.",
      })
    }

    const result = await sendEmail({
      to,
      subject: "InvestorPlugX test email",
      html: `<div style="font-family: system-ui, Arial, sans-serif; padding: 24px;"><h1>Test email works</h1><p>If you received this, Resend is configured correctly. From: ${fromEmail}</p></div>`,
      text: `Test email works. If you received this, Resend is configured correctly. From: ${fromEmail}`,
    })

    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        diagnosis: "Resend rejected the send. See resendError below.",
        resendError: result.error,
        env: {
          resendApiKeySet: true,
          resendFromEmail: fromEmail,
          nextAuthUrl: nextAuthUrl || "(missing — reset links default to localhost)",
        },
        hint: "403/validation_error usually means the sender domain is not verified in Resend (Domains > Verify SPF/DKIM). No entry in Resend Logs at all means the key is invalid.",
      })
    }

    return NextResponse.json({
      ok: true,
      diagnosis: "Resend accepted the send. Check inbox + spam for the test email.",
      env: {
        resendApiKeySet: true,
        resendFromEmail: fromEmail,
        nextAuthUrl: nextAuthUrl || "(missing — reset links default to localhost)",
      },
      hint: nextAuthUrl
        ? "Email sends. If reset LINKS still fail, the link uses NEXTAUTH_URL above — make sure it is your https live domain."
        : "Email sends, but NEXTAUTH_URL is missing so reset links point to localhost. Set NEXTAUTH_URL to your live domain and redeploy.",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }
    console.error("[admin/test-email] error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
