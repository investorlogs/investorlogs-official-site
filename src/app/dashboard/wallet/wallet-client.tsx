"use client"

import { useState } from "react"
import { Loader2, Plus, TrendingDown, TrendingUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

/** Result codes that /api/payments/callback redirects back to the wallet with. */
export type DepositResult = "success" | "failed" | "pending"

interface WalletTx {
  id: string
  amount: number
  type: string
  status: string
  reference: string | null
  createdAt: string
  updatedAt: string
}

interface WalletClientProps {
  initialBalance: number
  initialTransactions: WalletTx[]
  /**
   * Resolved on the server and passed down. This component is a "use client"
   * bundle, where process.env is not readable — reading the flag here would
   * always yield undefined and the deposit form could never appear.
   */
  canDeposit: boolean
  /** Set when the user arrives back from the payment gateway. */
  depositResult: DepositResult | null
}

function typeIcon(t: string) {
  switch (t) {
    case "DEPOSIT":
      return <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
    case "PURCHASE":
      return <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
    case "REFUND":
      return <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
    default:
      return <TrendingDown className="h-4 w-4" />
  }
}

function statusBadge(status: string) {
  const style =
    status === "COMPLETED"
      ? "default"
      : status === "PENDING"
        ? "secondary"
        : status === "FAILED"
          ? "destructive"
          : "outline"
  return <Badge variant={style}>{status}</Badge>
}

export function WalletClient({
  initialBalance: balance,
  initialTransactions: transactions,
  canDeposit,
  depositResult,
}: WalletClientProps) {
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<"card_paystack" | "crypto">("card_paystack")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const handleDeposit = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const numAmount = Number.parseFloat(amount)
      if (isNaN(numAmount) || numAmount <= 0) {
        setError("Please enter a valid amount.")
        return
      }

      const res = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: numAmount, method }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error ?? "Could not start the payment.")
        return
      }

      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl
        return
      }

      setNotice("Payment initialized but no checkout URL was returned.")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Deposit</h2>
        <p className="text-muted-foreground">
          Deposited funds can only be used to purchase products and services on
          this site.
        </p>
      </div>

      {depositResult && (
        <Alert
          variant={depositResult === "success" ? "default" : "destructive"}
        >
          <AlertDescription>
            {depositResult === "success" &&
              "Payment received. Your wallet balance has been updated."}
            {depositResult === "failed" &&
              "That payment did not complete. You have not been charged."}
            {depositResult === "pending" &&
              "We are still confirming this payment with our provider. It will " +
                "appear here as soon as it clears — you can safely close this page."}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>Balance</CardTitle>
          <CardDescription>Available funds in your wallet.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold">{`₦${balance.toFixed(2)}`}</p>
        </CardContent>
      </Card>

      {!canDeposit ? (
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle>Deposits are coming soon</CardTitle>
            <CardDescription>
              We are still finishing our payment integration. You will be able to
              top up your wallet here shortly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Need funds right away? Contact support and we will help you sort it
              out.
            </p>
          </CardContent>
        </Card>
      ) : (
      <Card>
        <CardHeader>
          <CardTitle>Add funds</CardTitle>
          <CardDescription>
            Enter an amount and choose a payment method to top up.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {notice && (
            <Alert>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <label htmlFor="deposit-amount" className="text-sm font-medium">
              Amount (NGN)
            </label>
            <Input
              id="deposit-amount"
              type="number"
              min="1"
              max="100000"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant={method === "card_paystack" ? "default" : "outline"}
              onClick={() => setMethod("card_paystack")}
              disabled={busy}
            >
              Card (Paystack)
            </Button>
          </div>

          <Button
            className="w-full"
            disabled={busy || !amount}
            onClick={handleDeposit}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                {`Deposit ₦${amount || "0.00"}`}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
          <CardDescription>
            Your last {transactions.length} wallet movements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No transactions yet. Add funds to get started.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex items-center gap-3">
                    {typeIcon(tx.type)}
                    <div>
                      <p className="font-medium">{tx.type.toLowerCase()}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <span
                      className={
                        tx.type === "DEPOSIT"
                          ? "font-medium text-green-600 dark:text-green-400"
                          : tx.type === "REFUND"
                            ? "font-medium text-blue-600 dark:text-blue-400"
                            : "font-medium"
                      }
                    >
                      {tx.type === "DEPOSIT" ? "+" : "-"}{`₦${Math.abs(tx.amount).toFixed(2)}`}
                    </span>
                    {statusBadge(tx.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
