"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Ban, CheckCheck, Loader2, PackageOpen, TrendingUp, Timer } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SMM_POLL_INTERVAL_MS } from "@/lib/smm-catalog"

interface PlatformOption {
  code: string
  name: string
  icon: string
}

interface SmmServiceDisplay {
  serviceId: string
  platform: string
  name: string
  serviceType: string
  rate: number
  minQty: number
  maxQty: number
}

interface CatalogData {
  platforms: PlatformOption[]
  services: SmmServiceDisplay[]
  markupPercent: number
}

type Phase =
  | { kind: "idle" }
  | { kind: "ordering" }
  | { kind: "active"; orderId: string; serviceName: string; targetLink: string; quantity: number; price: number }
  | { kind: "completed"; orderId: string; serviceName: string }
  | { kind: "closed"; outcome: "cancelled" | "expired"; refundAmount: number | null; message: string | null; serviceName: string }

/**
 * Calculates the marked-up unit rate per 1,000 units for display.
 * This ensures consistent pricing across the UI.
 */
function calculateMarkedUpRate(rate: number, markupPercent: number): number {
  if (!Number.isFinite(rate) || !Number.isFinite(markupPercent)) {
    return 0
  }
  return rate * (1 + markupPercent / 100)
}

/**
 * Mirrors the backend's `computeSmmCharge` (Prisma Decimal, rate*qty/1000,
 * markup applied, then ROUND_UP to whole cents) using integer arithmetic so
 * the live total never drifts a cent from the amount the user is actually
 * charged. The rate is the provider cost per 1,000 units in NGN.
 */
function calculateTotal(rate: number, quantity: number, markupPercent: number): number {
  if (
    !Number.isFinite(rate) ||
    !Number.isFinite(quantity) ||
    !Number.isFinite(markupPercent) ||
    quantity <= 0
  ) {
    return 0
  }

  // Mirror the backend's computeSmmCharge (Prisma Decimal: rate*qty/1000,
  // markup applied, then ROUND_UP to whole cents) using integer arithmetic so
  // the live total never drifts a cent from the amount the user is charged.
  // rateScaled = rate * 10^6, markupScaled = markup% * 10^4.
  const rateScaled = BigInt(Math.round(rate * 1_000_000))
  const markupScaled = BigInt(Math.round(markupPercent * 10_000))
  const qty = BigInt(Math.trunc(quantity))
  const scale = BigInt(10)
  // charge(NGN) = rate * qty/1000 * (1 + mk/100)
  //             = rateScaled * qty * (1_000_000 + markupScaled) / 10^15
  // chargeCents = charge * 100 = rateScaled * qty * (1_000_000 + markupScaled) / 10^13
  const numerator = rateScaled * qty * (BigInt(1_000_000) + markupScaled)
  const denominator = scale ** BigInt(13) // 10^13
  const zero = BigInt(0)
  const one = BigInt(1)
  const chargeCents =
    numerator > zero ? (numerator + denominator - one) / denominator : zero
  return Number(chargeCents) / 100
}

export function SmmClient() {
  const [catalog, setCatalog] = useState<CatalogData | null>(null)
  const [platform, setPlatform] = useState<string>("instagram")
  const [selectedService, setSelectedService] = useState<string>("")
  const [targetLink, setTargetLink] = useState("")
  const [quantity, setQuantity] = useState(1000)
  const [phase, setPhase] = useState<Phase>({ kind: "idle" })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const initialLoadRef = useRef(true)

  const normalizePlatform = (p: string) => p.toLowerCase().replace(/[\s/_-]+/g, "")
  const servicesForPlatform =
    catalog?.services.filter((s) => normalizePlatform(s.platform) === normalizePlatform(platform)) ?? []
  const effectiveServiceId = selectedService || servicesForPlatform[0]?.serviceId || ""
  const service = servicesForPlatform.find((s) => s.serviceId === effectiveServiceId)
  const markupPercent = catalog?.markupPercent ?? 40
  const markedUpRate = service ? calculateMarkedUpRate(service.rate, markupPercent) : 0
  const totalCost = service ? calculateTotal(service.rate, quantity, markupPercent) : 0

  // Resolves the first service for a platform code (used to reset selection).
  const firstServiceForPlatform = (code: string): SmmServiceDisplay | undefined =>
    (catalog?.services ?? []).find((s) => normalizePlatform(s.platform) === normalizePlatform(code))

  // Load catalog on mount and auto-select first platform/service + min quantity.
  useEffect(() => {
    let cancelled = false
    fetch("/api/smm/catalog")
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => null)
          throw new Error(err?.error ?? `Could not load services (${res.status}).`)
        }
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        if (data?.services) {
          const platforms: PlatformOption[] = data.platforms ?? []
          setCatalog({
            platforms,
            services: data.services,
            markupPercent: data.markupPercent ?? 40,
          })
          if (initialLoadRef.current && platforms.length > 0) {
            const code = platforms[0].code
            setPlatform(code)
            const first = data.services.find(
              (s: SmmServiceDisplay) => normalizePlatform(s.platform) === normalizePlatform(code)
            )
            setSelectedService(first ? first.serviceId : "")
            if (first) setQuantity(first.minQty)
            initialLoadRef.current = false
          }
        } else {
          setError(data?.error ?? "No services available right now.")
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? "Could not load SMM services. Please refresh.")
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Resume an in-flight order after a page refresh.
  useEffect(() => {
    fetch("/api/smm/active")
      .then((res) => res.json())
      .then((data) => {
        const o = data?.order
        if (!o) return
        if (o.status === "COMPLETED") {
          setPhase({ kind: "completed", orderId: o.id, serviceName: o.serviceName ?? "" })
          return
        }
        if (o.status === "CANCELLED") {
          setPhase({
            kind: "closed",
            outcome: "cancelled",
            refundAmount: null,
            message: null,
            serviceName: o.serviceName ?? "",
          })
          return
        }
        setPhase({
          kind: "active",
          orderId: o.id,
          serviceName: o.serviceName ?? "",
          targetLink: o.targetLink,
          quantity: o.quantity,
          price: o.price,
        })
      })
      .catch(() => undefined)
  }, [])

  const handleOrder = async () => {
    if (!service) return
    if (!targetLink) {
      setError("Please enter a target URL or link.")
      return
    }
    const qty = Number(quantity)
    if (!Number.isInteger(qty) || qty < service.minQty || qty > service.maxQty) {
      setError(`Quantity must be a whole number between ${service.minQty} and ${service.maxQty}.`)
      return
    }

    setBusy(true)
    setError(null)
      setPhase({ kind: "ordering" })
      try {
        const res = await fetch("/api/smm/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceId: service.serviceId,
            targetLink,
            quantity: qty,
            total: totalCost,
          }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          setError(data?.error ?? "Could not place the order. Please try again.")
          setPhase({ kind: "idle" })
          return
        }
        setPhase({
          kind: "active",
          orderId: data.order.id,
          serviceName: data.order.serviceName ?? "",
          targetLink,
          quantity: qty,
          price: totalCost, // Use the marked-up price we calculated, not the base price
        })
      } catch {
        setError("Network error. Please try again.")
        setPhase({ kind: "idle" })
      } finally {
        setBusy(false)
      }
  }

  const handlePoll = useCallback(async (orderId: string) => {
    try {
      const res = await fetch(`/api/smm/status?orderId=${orderId}`)
      if (!res.ok) return
      const data = await res.json()
      const o = data?.order
      if (!o) return

      if (o.status === "COMPLETED") {
        setPhase({ kind: "completed", orderId, serviceName: o.serviceName ?? "" })
      } else if (o.status === "CANCELLED") {
        setPhase({
          kind: "closed",
          outcome: "cancelled",
          refundAmount: o.refundAmount ?? null,
          message: null,
          serviceName: o.serviceName ?? "",
        })
      } else if (o.status === "PARTIAL") {
        setPhase({
          kind: "closed",
          outcome: "cancelled",
          refundAmount: null,
          message: "Order partially completed.",
          serviceName: o.serviceName ?? "",
        })
      }
      // PENDING and PROCESSING: keep polling
    } catch {
      // Transient network issue — keep polling.
    }
  }, [])

  const resetToIdle = () => {
    setPhase({ kind: "idle" })
    setError(null)
    setTargetLink("")
    setQuantity(service?.minQty ?? 1000)
    setSelectedService("")
  }

  // Live polling for the active phase.
  useEffect(() => {
    if (phase.kind !== "active") return
    const id = setInterval(() => {
      void handlePoll(phase.orderId)
    }, SMM_POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [phase, handlePoll])

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {phase.kind === "completed" && (
        <Card>
          <CardHeader className="items-center space-y-2 text-center">
            <CheckCheck className="h-10 w-10 text-green-600 dark:text-green-400" />
            <CardTitle>Order completed</CardTitle>
            <CardDescription>
              Your {phase.serviceName} boost is being delivered.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={resetToIdle}>
              Order another boost
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
                  ? "The order reached its completion window without finishing."
                  : "The order was cancelled before completion.")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {phase.refundAmount !== null && (
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                {`₦${phase.refundAmount.toFixed(2)} was refunded to your wallet.`}
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={resetToIdle}>Order another boost</Button>
          </CardFooter>
        </Card>
      )}

      {phase.kind === "active" && (
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">In Progress</Badge>
              <Badge variant={phase.quantity > 0 ? "default" : "outline"}>
                Qty: {phase.quantity.toLocaleString()}
              </Badge>
            </div>
            <CardTitle className="flex items-center gap-2 pt-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              {phase.serviceName}
            </CardTitle>
            <CardDescription>
              Target: {phase.targetLink} · {`₦${phase.price.toFixed(2)} charged`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your boost order is being processed by the provider. The status
              will update automatically — keep this page open until it
              completes.
            </p>
            {busy && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking status…
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={resetToIdle}>
              Back to new order
            </Button>
          </CardFooter>
        </Card>
      )}

      {phase.kind === "idle" && (
        <Card>
          <CardHeader>
            <CardTitle>Order a social boost</CardTitle>
            <CardDescription>
              Select a platform and service, enter your target link and
              quantity. All prices include service fees.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!catalog && !error && (
              <p className="text-sm text-muted-foreground">Loading services…</p>
            )}

            {catalog && (
              <>
                {/* Platform selector */}
                <div className="space-y-1.5">
                  <span className="text-sm font-medium">Platform</span>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {catalog.platforms.map((p) => (
                      <button
                        key={p.code}
                        type="button"
                         onClick={() => {
                           setPlatform(p.code)
                           const first = firstServiceForPlatform(p.code)
                           setSelectedService(first ? first.serviceId : "")
                           if (first) setQuantity(first.minQty)
                         }}
                        className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                          platform === p.code
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:bg-accent"
                        }`}
                      >
                        <span className="text-2xl" aria-hidden>{p.icon || "🌐"}</span>
                        <span className="truncate">{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Service dropdown */}
                <div className="space-y-1.5">
                  <label htmlFor="smm-service" className="text-sm font-medium">
                    Service
                  </label>
                   <Select
                     value={effectiveServiceId}
                     onValueChange={(value) => {
                       const next = value ?? ""
                       setSelectedService(next)
                       const svc = servicesForPlatform.find((s) => s.serviceId === next)
                       if (svc) setQuantity(svc.minQty)
                     }}
                     disabled={busy || servicesForPlatform.length === 0 || !catalog}
                   >
                    <SelectTrigger id="smm-service" className="w-full">
                      <SelectValue placeholder="Select a service" />
                    </SelectTrigger>
                     <SelectContent>
                       {servicesForPlatform.length === 0 ? (
                         <div className="p-3 text-sm text-muted-foreground">
                           No services for this platform right now.
                         </div>
                       ) : (
                         servicesForPlatform.map((s) => {
                           const markedUpRate = calculateMarkedUpRate(s.rate, markupPercent)
                           return (
                             <SelectItem key={s.serviceId} value={s.serviceId}>
                               <div className="flex flex-col">
                                 <span>{s.name}</span>
                                 <span className="text-xs text-muted-foreground">
                                   {`₦${markedUpRate.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / 1k · min ${s.minQty}`}
                                 </span>
                               </div>
                             </SelectItem>
                           )
                         })
                       )}
                     </SelectContent>
                  </Select>
                </div>

                {/* Target link */}
                <div className="space-y-1.5">
                  <label htmlFor="smm-target" className="text-sm font-medium">
                    Target URL / Link
                  </label>
                  <Input
                    id="smm-target"
                    type="url"
                    placeholder="https://instagram.com/yourhandle"
                    value={targetLink}
                    onChange={(e) => setTargetLink(e.target.value)}
                    disabled={busy}
                    maxLength={500}
                  />
                </div>

                {/* Quantity */}
                <div className="space-y-1.5">
                  <label htmlFor="smm-quantity" className="text-sm font-medium">
                    Quantity
                  </label>
                 <Input
                   id="smm-quantity"
                   type="number"
                   min={service?.minQty ?? 1}
                   max={service?.maxQty ?? 100000}
                   step={1}
                   value={quantity}
                   onChange={(e) => {
                     const v = Number(e.target.value)
                     setQuantity(Number.isFinite(v) ? v : service?.minQty ?? 1)
                   }}
                   disabled={busy || !service}
                 />
                  {service && (
                    <p className="text-xs text-muted-foreground">
                      Minimum: {service.minQty.toLocaleString()} · Maximum:{" "}
                      {service.maxQty.toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Pricing breakdown */}
                {service && markedUpRate > 0 && (
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Unit rate (per 1,000)</span>
                      <span className="font-medium">
                        ₦{markedUpRate.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Quantity</span>
                      <span className="font-medium">{quantity.toLocaleString()}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between text-base font-semibold">
                      <span>Total</span>
                      <span>₦{totalCost.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
          <CardFooter className="justify-end">
             <Button
               disabled={
                 busy ||
                 !catalog ||
                 !service ||
                 !targetLink ||
                 !Number.isInteger(quantity) ||
                 quantity < (service?.minQty ?? 1) ||
                 quantity > (service?.maxQty ?? Infinity)
               }
               onClick={handleOrder}
             >
              {busy ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <TrendingUp data-icon="inline-start" />
              )}
              {busy ? "Placing order…" : "Boost now"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {phase.kind === "ordering" && (
        <Card>
          <CardHeader>
            <CardTitle>Placing your order…</CardTitle>
          </CardHeader>
          <CardContent>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      {phase.kind === "idle" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <PackageOpen className="h-4 w-4" />
          <span>
            Questions? Visit the{" "}
            <a href="/dashboard/support" className="underline">
              support page
            </a>
            .
          </span>
        </div>
      )}
    </div>
  )
}
