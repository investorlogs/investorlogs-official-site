"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Search } from "lucide-react"
import {
  Ban,
  CheckCheck,
  CircleCheck,
  Copy,
  Loader2,
  PhoneCall,
  Timer,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatNaira } from "@/lib/currency"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SMS_POLL_INTERVAL_MS, SMS_ORDER_TTL_MS } from "@/lib/sms-catalog"

interface SmsCountryOption {
  code: string
  name: string
  flag: string
}

interface SmsServiceOption {
  code: string
  name: string
  icon: string
}

interface CatalogLists {
  countries: SmsCountryOption[]
  services: SmsServiceOption[]
}

/** Customer-facing price only — supplier cost is never sent to the browser. */
type ServicePrice = { price: number } | null

type Phase =
  | { kind: "idle" }
  | { kind: "ordering" }
  | {
      kind: "active"
      orderId: string
      phoneNumber: string
      price: number
      expiresAt: number
      country: string
      service: string
    }
  | { kind: "completed"; orderId: string; code: string; service: string }
  | {
      kind: "closed"
      outcome: "cancelled" | "expired"
      refundAmount: number | null
      message: string | null
    }

async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the legacy path below
  }
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  try {
    return document.execCommand("copy")
  } catch {
    return false
  } finally {
    textarea.remove()
  }
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

export function SmsClient() {
  const [lists, setLists] = useState<CatalogLists | null>(null)
  const [country, setCountry] = useState("usa")
  const [service, setService] = useState("")
  // Prices are stored with the country they were fetched for, so a stale
  // response for a previously-selected country can never be shown against the
  // current selection.
  const [catalog, setCatalog] = useState<{
    country: string
    prices: Record<string, ServicePrice>
  } | null>(null)
  const prices = catalog && catalog.country === country ? catalog.prices : null
  const [phase, setPhase] = useState<Phase>({ kind: "idle" })
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [remainingMs, setRemainingMs] = useState(SMS_ORDER_TTL_MS)
  const [catalogStatus, setCatalogStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  )
  const [searchQuery, setSearchQuery] = useState("")
  const timeoutHandledRef = useRef(false)

  // Load the public catalog whenever the country changes. A failed request must
  // clear the previous lists/prices; otherwise the UI silently shows an empty
  // selector or, worse, stale prices from another country.
  useEffect(() => {
    let cancelled = false
    const requestedCountry = country
    const controller = new AbortController()

    async function loadCatalog() {
      try {
        const res = await fetch(
          `/api/sms/catalog?country=${encodeURIComponent(requestedCountry)}`,
          { signal: controller.signal, cache: "no-store" }
        )
        const data = await res.json().catch(() => null)
        if (cancelled) return

        if (!res.ok) {
          throw new Error(data?.error ?? "Could not load SMS pricing. Please try again.")
        }
        if (!Array.isArray(data?.countries) || !Array.isArray(data?.services)) {
          throw new Error("The SMS provider returned an invalid catalog.")
        }

        setLists({ countries: data.countries, services: data.services })
        setCatalog({ country: requestedCountry, prices: data.prices ?? {} })
        setService(data.services[0]?.code ?? "")
        setError(null)
        setCatalogStatus("ready")
      } catch (loadError) {
        if (cancelled || (loadError instanceof DOMException && loadError.name === "AbortError")) {
          return
        }
        setLists(null)
        setCatalog(null)
        setService("")
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load SMS pricing. Please try again."
        )
        setCatalogStatus("error")
      }
    }

    void loadCatalog()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [country])

  // Resume an in-flight order after a page refresh.
  useEffect(() => {
    fetch("/api/sms/active")
      .then((res) => res.json())
      .then((data) => {
        const o = data?.order
        if (!o) return
        // A code that already arrived survives refreshes — jump straight to
        // the completed view instead of renting another number.
        if (o.status === "RECEIVED" && o.code) {
           setPhase({ kind: "completed", orderId: o.id, code: o.code, service: o.service ?? "" })
          return
        }
        timeoutHandledRef.current = false
        setPhase({
          kind: "active",
          orderId: o.id,
          phoneNumber: o.phoneNumber ?? "",
          price: o.price,
          expiresAt: new Date(o.expiresAt).getTime(),
          country: o.country,
          service: o.service,
        })
      })
      .catch(() => undefined)
  }, [])

  // Order a number: debits wallet, creates the order, rents from provider.
  const handleOrder = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch("/api/sms/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, service }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error ?? "Could not order a number. Please try again.")
        return
      }
      timeoutHandledRef.current = false
      setPhase({
        kind: "active",
        orderId: data.order.id,
        phoneNumber: data.order.phoneNumber,
        price: data.order.price,
        expiresAt: new Date(data.order.expiresAt).getTime(),
        country,
        service,
      })
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  // Cancel (user click) or expire (countdown reached zero): releases the
  // number server-side and refunds the wallet automatically.
  const handleCancel = useCallback(
    async (orderId: string, reason: "user" | "timeout") => {
      setBusy(true)
      setError(null)
      try {
        const res = await fetch("/api/sms/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, reason }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          setError(data?.error ?? "Could not cancel the order. It will expire shortly.")
          return
        }
        const o = data?.order
        if (o?.status === "RECEIVED" && o?.code) {
           setPhase({ kind: "completed", orderId, code: o.code, service: o.service ?? "" })
        } else {
          setPhase({
            kind: "closed",
            outcome: o?.status === "EXPIRED" ? "expired" : "cancelled",
            refundAmount: o?.refundAmount ?? null,
            message: data?.message ?? null,
          })
        }
      } catch {
        setError("Network error while cancelling. It will expire automatically.")
      } finally {
        setBusy(false)
      }
    },
    []
  )

  // Countdown timer (1s tick). At zero the order is cancelled + refunded.
  useEffect(() => {
    if (phase.kind !== "active") return
    const tick = () => {
      const remaining = phase.expiresAt - Date.now()
      setRemainingMs(Math.max(0, remaining))
      if (remaining <= 0 && !timeoutHandledRef.current) {
        timeoutHandledRef.current = true
        void handleCancel(phase.orderId, "timeout")
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [phase, handleCancel])

  // Live polling: check the provider for an incoming code every 4 seconds.
  useEffect(() => {
    if (phase.kind !== "active") return
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/sms/check-status?orderId=${phase.orderId}`)
        if (res.status === 429) {
          setNotice("We are busy right now — still listening for your SMS...")
          return
        }
        if (!res.ok) return
        const data = await res.json()
        const o = data?.order
        if (!o) return
        if (o.status === "RECEIVED" && o.code) {
           setPhase({ kind: "completed", orderId: phase.orderId, code: o.code, service: phase.service })
        } else if (o.status === "CANCELLED" || o.status === "EXPIRED") {
          setPhase({
            kind: "closed",
            outcome: o.status === "CANCELLED" ? "cancelled" : "expired",
            refundAmount: o.refundAmount ?? null,
            message: null,
          })
        }
      } catch {
        // Transient network issue — keep polling.
      }
    }, SMS_POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [phase])

  const handleCopyCode = async (code: string) => {
    if (await copyText(code)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }


  const resetToIdle = () => {
    setPhase({ kind: "idle" })
    setNotice(null)
    setError(null)
  }

  const selectedPrice = prices ? prices[service] : undefined
  const visibleServices = (lists?.services ?? []).filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
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

      {phase.kind === "completed" && (
        <Card>
          <CardHeader className="items-center space-y-2 text-center">
            <CircleCheck className="h-10 w-10 text-green-600 dark:text-green-400" />
            <CardTitle>Your verification code</CardTitle>
            <CardDescription>
              The SMS for {phase.service} arrived — copy the code below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-muted px-4 py-8 text-center">
              <span className="text-3xl font-bold tracking-[0.35em]">
                {phase.code}
              </span>
            </div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button onClick={() => handleCopyCode(phase.code)}>
              {copied ? (
                <CheckCheck data-icon="inline-start" />
              ) : (
                <Copy data-icon="inline-start" />
              )}
              {copied ? "Copied" : "Copy code"}
            </Button>
            <Button variant="outline" onClick={resetToIdle}>
              Done
            </Button>
          </CardFooter>
        </Card>
      )}

      {phase.kind === "closed" && (
        <Card>
          <CardHeader className="space-y-2">
            {phase.outcome === "expired" ? (
              <Timer className="h-10 w-10 text-muted-foreground" />
            ) : (
              <Ban className="h-10 w-10 text-muted-foreground" />
            )}
            <CardTitle>
              {phase.outcome === "expired" ? "Order expired" : "Order cancelled"}
            </CardTitle>
            <CardDescription>
              {phase.message ??
                (phase.outcome === "expired"
                  ? "The rental window ran out before a code arrived."
                  : "The number was released before any code arrived.")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {phase.refundAmount !== null && !phase.message && (
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                {`${formatNaira(phase.refundAmount)} was refunded to your wallet.`}
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={resetToIdle}>Get a new number</Button>
          </CardFooter>
        </Card>
      )}

      {phase.kind === "active" && (
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Waiting for SMS</Badge>
              <Badge variant="outline">
                <Timer className="h-3 w-3" />
                {formatCountdown(remainingMs)}
              </Badge>
            </div>
            <CardTitle className="flex items-center gap-2 pt-2 text-2xl">
              <PhoneCall className="h-5 w-5 text-muted-foreground" />
              {phase.phoneNumber}
            </CardTitle>
            <CardDescription>
              {phase.service} &middot; {phase.country} &middot; {`${formatNaira(phase.price)} charged`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Use this number for your {phase.service} verification. Your code
              will appear here automatically — keep this page open until it
              arrives.
            </p>
            {busy && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Releasing the number&hellip;
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => handleCancel(phase.orderId, "user")}
            >
              <Ban data-icon="inline-start" />
              Cancel &amp; refund
            </Button>
          </CardFooter>
        </Card>
      )}

      {(phase.kind === "idle" || phase.kind === "ordering") && (
        <Card>
          <CardHeader>
            <CardTitle>Order a virtual number</CardTitle>
            <CardDescription>
              Pick a country and a service. The price shown is the all-in cost
              and is charged to your wallet the moment the number is reserved.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="sms-country" className="text-sm font-medium">
                Country
              </label>
              <select
                id="sms-country"
                value={country}
                disabled={catalogStatus === "loading" || busy}
                onChange={(event) => {
                  setCountry(event.target.value)
                  setLists(null)
                  setCatalog(null)
                  setService("")
                  setError(null)
                  setCatalogStatus("loading")
                }}
                className="h-8 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
              >
                {catalogStatus === "loading" ? (
                  <option value="">Loading countries…</option>
                ) : (
                  (lists?.countries ?? []).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <span className="text-sm font-medium">Service</span>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search services..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </div>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
                <div className="grid gap-2 sm:grid-cols-2">
                  {catalogStatus === "loading" ? (
                    <p className="p-4 text-sm text-muted-foreground">Loading services…</p>
                  ) : catalogStatus === "error" ? (
                    <p className="p-4 text-sm text-destructive">
                      Services are temporarily unavailable. Please refresh and try again.
                    </p>
                  ) : visibleServices.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                      No matching services are available.
                    </p>
                  ) : (
                    visibleServices.map((s) => {
                      const p = prices ? prices[s.code] : undefined
                      const isSelected = service === s.code
                      const unavailable = p === undefined || p === null
                      return (
                        <button
                          key={s.code}
                          type="button"
                          disabled={unavailable || busy}
                          onClick={() => setService(s.code)}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors disabled:opacity-50 ${
                            isSelected
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border hover:bg-accent"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span aria-hidden>{s.icon}</span>
                            {s.name}
                          </span>
                          <span className="font-medium">
                            {p === undefined
                              ? "…"
                              : p === null
                                ? "No stock"
                                : formatNaira(p.price)}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedPrice ? `Total: ${formatNaira(selectedPrice.price)}` : "—"}
            </span>
            <Button disabled={busy || !selectedPrice} onClick={handleOrder}>
              {busy ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <PhoneCall data-icon="inline-start" />
              )}
              {busy ? "Reserving number…" : "Rent number"}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}

