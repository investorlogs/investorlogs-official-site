"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CreditCard, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function MockCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; amount?: string }>
}) {
  const router = useRouter()
  const [ref, setRef] = useState<string | null>(null)
  const [amount, setAmount] = useState<string>("0.00")
  const [step, setStep] = useState<"processing" | "success" | "error">("processing")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void searchParams
      .then((params) => {
        const r = params.ref ?? null
        setRef(r)
        setAmount(params.amount ?? "0.00")
      })
      .catch(() => setStep("error"))
  }, [searchParams])

  useEffect(() => {
    if (!ref || step !== "processing") return

    let cancelled = false
    const timer = setTimeout(async () => {
      if (cancelled) return
      try {
        const res = await fetch("/api/payments/mock-confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference: ref }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          if (!cancelled) {
            setError(data?.error ?? "Payment could not be confirmed.")
            setStep("error")
          }
          return
        }
        if (!cancelled) {
          setStep("success")
          setTimeout(() => router.push("/dashboard/wallet"), 1500)
        }
      } catch {
        if (!cancelled) {
          setError("Network error during payment confirmation.")
          setStep("error")
        }
      }
    }, 1200)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [ref, step, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="w-full max-w-md space-y-6 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Mock Payment</h1>
          <p className="text-sm text-muted-foreground">
            Amount: <strong>₦{amount}</strong>
          </p>
        </div>

        <div className="rounded-lg border bg-card p-8 text-center">
          {step === "processing" && (
            <>
              <CreditCard className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">
                Processing payment of ₦{amount}...
              </p>
            </>
          )}

          {step === "success" && (
            <>
              <CheckCircle2 className="mx-auto h-8 w-8 text-green-600 dark:text-green-400" />
              <p className="mt-4 text-sm font-medium text-green-600 dark:text-green-400">
                Payment confirmed! Redirecting to your wallet...
              </p>
            </>
          )}

          {step === "error" && (
            <>
              <XCircle className="mx-auto h-8 w-8 text-destructive" />
              <p className="mt-4 text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.push("/dashboard/wallet")}
              >
                Back to wallet
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
