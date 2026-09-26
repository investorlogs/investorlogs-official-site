"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"

function VerifyForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState(searchParams.get("email") ?? "")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      })
      const result = await response.json()
      if (!response.ok) {
        setError(result.error || "Verification failed")
        return
      }
      setSuccess("Email verified! Redirecting to sign in…")
      setTimeout(() => router.push("/auth/login?verified=true"), 1200)
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const onResend = async () => {
    if (!email) {
      setError("Enter your email first, then resend the code.")
      return
    }
    setIsResending(true)
    setError(null)
    try {
      await fetch("/api/auth/verify/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      setSuccess("A fresh code is on its way. Check your inbox (and spam).")
    } catch {
      setError("Could not resend the code. Try again.")
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
          <CardDescription>
            We sent a 6-digit verification code to your Gmail. Enter it below to activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <Input id="email" type="email" placeholder="you@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} required />
            </div>
            <div className="space-y-2">
              <label htmlFor="code" className="text-sm font-medium">6-digit code</label>
              <Input id="code" inputMode="numeric" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} disabled={isLoading} required />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Verifying…" : "Verify email"}
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={onResend} disabled={isResending}>
              {isResending ? "Sending…" : "Resend code"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-muted-foreground text-center">
            <Link href="/auth/login" className="text-primary hover:underline">Back to sign in</Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center px-4"><Skeleton className="h-96 w-full max-w-md" /></div>}>
      <VerifyForm />
    </Suspense>
  )
}
