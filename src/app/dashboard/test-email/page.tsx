"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Mail, Loader2 } from "lucide-react"

type TestResult = {
  ok?: boolean
  diagnosis?: string
  resendError?: string
  error?: string
  env?: { resendApiKeySet: boolean; resendFromEmail: string; nextAuthUrl: string }
  hint?: string
}

export default function TestEmailPage() {
  const [to, setTo] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)

  async function run() {
    setLoading(true)
    setResult(null)
    try {
      const response = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim() }),
      })
      const data = await response.json()
      setResult(data)
    } catch {
      setResult({ error: "Request failed. Are you logged in as admin?" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Test Email</h2>
        <p className="text-muted-foreground">
          Admin-only. Sends a real test email via Resend and shows the exact
          result — no log digging.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Send test email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              run()
            }}
            className="flex gap-2"
          >
            <Input
              type="email"
              placeholder="you@gmail.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !to.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Sending…" : "Send"}
            </Button>
          </form>

          {result && (
            <div
              className={`rounded-lg border p-4 text-sm whitespace-pre-wrap ${
                result.ok
                  ? "border-green-500/40 bg-green-500/10"
                  : "border-destructive/50 bg-destructive/10"
              }`}
            >
              {result.diagnosis && <p className="font-semibold">{result.diagnosis}</p>}
              {result.error && <p className="font-semibold">{result.error}</p>}
              {result.resendError && (
                <p className="mt-2 font-mono text-xs">Resend: {result.resendError}</p>
              )}
              {result.env && (
                <div className="mt-2 font-mono text-xs opacity-80">
                  <p>RESEND_API_KEY set: {String(result.env.resendApiKeySet)}</p>
                  <p>From: {result.env.resendFromEmail}</p>
                  <p>NEXTAUTH_URL: {result.env.nextAuthUrl}</p>
                </div>
              )}
              {result.hint && <p className="mt-2 text-xs opacity-80">{result.hint}</p>}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Requires an ADMIN session. Non-admins get 403. After fixing env
            vars on Vercel you must Redeploy, then re-run this test.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
