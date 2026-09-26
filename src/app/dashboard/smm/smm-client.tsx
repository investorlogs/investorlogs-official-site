"use client"

import { useEffect, useRef, useState } from "react"
import { Search, TrendingUp, Loader2 } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface SmmService {
  serviceId: string
  platform: string
  name: string
  serviceType: string
  rate: number
  minQty: number
  maxQty: number
}

interface PlatformOption {
  code: string
  name: string
  icon: string
}

type Phase =
  | { kind: "idle" }
  | { kind: "ordering" }
  | { kind: "order-placed"; orderId: string; serviceName: string; targetLink: string; quantity: number }
  | { kind: "completed"; orderId: string; serviceName: string; targetLink: string; quantity: number; startCount?: number; remains?: number }

const PLATFORM_ICONS: Record<string, string> = {
  instagram: "📷",
  tiktok: "🎵",
  youtube: "▶️",
  twitter: "🐦",
  "twitter/x": "🐦",
  x: "🐦",
  facebook: "📘",
  telegram: "✈️",
  spotify: "🎧",
  reddit: "🔴",
  linkedin: "💼",
  discord: "🎮",
  snapchat: "👻",
  pinterest: "📌",
}

function formatSmmPrice(rate: number, markupPercent: number, quantity: number): string {
  const cost = rate * (quantity / 1000) * (1 + markupPercent / 100)
  const rounded = Math.ceil(cost * 100) / 100
  return `₦${rounded.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function SmmClient() {
  const [platforms, setPlatforms] = useState<PlatformOption[]>([])
  const [services, setServices] = useState<SmmService[]>([])
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all")
  const [selectedService, setSelectedService] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [targetLink, setTargetLink] = useState("")
  const [quantity, setQuantity] = useState<number>(100)
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [phase, setPhase] = useState<Phase>({ kind: "idle" })
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [markup, setMarkup] = useState(40)
  const pollingRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const url = new URL("/api/smm/catalog", window.location.origin)
    if (selectedPlatform && selectedPlatform !== "all") {
      url.searchParams.set("platform", selectedPlatform)
    }
    fetch(url.toString())
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (!data?.platforms) {
          const code = data?.code ? ` (${data.code})` : ""
          const detail = data?.detail ? `: ${data.detail}` : ""
          setError(`${data?.error ?? "Could not load services."}${code}${detail}`)
          return
        }
        setPlatforms(data.platforms ?? [])
        setServices(data.services ?? [])
        setMarkup(data.markupPercent ?? 40)
        const priceMap: Record<string, number> = {}
        for (const s of data.services ?? []) {
          priceMap[s.serviceId] = s.rate
        }
        setPrices(priceMap)
      })
      .catch(() => {
        if (!cancelled) setError("Could not load services. Please refresh.")
      })
    return () => {
      cancelled = true
    }
  }, [selectedPlatform])

  useEffect(() => {
    if (phase.kind !== "order-placed") return
    const poll = async () => {
      try {
        const res = await fetch(`/api/smm/status?orderId=${encodeURIComponent(phase.orderId)}`)
        if (!res.ok) return
        const data = await res.json()
        const order = data?.order
        if (!order) return
        if (order.status === "Completed") {
          setPhase({
            kind: "completed",
            orderId: phase.orderId,
            serviceName: phase.serviceName,
            targetLink: phase.targetLink,
            quantity: phase.quantity,
            startCount: order.startCount,
            remains: order.remains,
          })
        } else if (order.status === "Canceled" || order.status === "Cancelled") {
          setPhase({ kind: "idle" })
          setNotice("Order was cancelled.")
        }
      } catch {
        // transient
      }
    }
    pollingRef.current = window.setInterval(poll, 5000)
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current)
    }
  }, [phase])

  const selectedServiceData = services.find((s) => s.serviceId === selectedService)
  const rate = prices[selectedService] ?? 0
  const estimatedCost = rate > 0 ? Math.ceil(rate * (quantity / 1000) * (1 + markup / 100) * 100) / 100 : 0

  const filteredServices = services.filter((s) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return s.name.toLowerCase().includes(q) || s.platform.toLowerCase().includes(q) || s.serviceType.toLowerCase().includes(q)
  })

  const handleOrder = async () => {
    if (!selectedService || !targetLink || quantity <= 0) {
      setError("Please select a service, enter a target link, and set a quantity.")
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch("/api/smm/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: selectedService, targetLink, quantity }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error ?? "Could not place the order.")
        return
      }
      setPhase({
        kind: "order-placed",
        orderId: data.order.id,
        serviceName: data.order.serviceName,
        targetLink,
        quantity,
      })
      setNotice(data.message ?? "Order placed successfully.")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setPhase({ kind: "idle" })
    setNotice(null)
    setError(null)
  }

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
            <TrendingUp className="h-10 w-10 text-green-600 dark:text-green-400" />
            <CardTitle>Order completed</CardTitle>
            <CardDescription>
              {phase.serviceName} for <span className="font-mono break-all">{phase.targetLink}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Quantity ordered: {phase.quantity.toLocaleString()}</p>
            {phase.startCount !== undefined && (
              <p>Start count: {phase.startCount.toLocaleString()}</p>
            )}
            {phase.remains !== undefined && (
              <p>Remaining: {phase.remains.toLocaleString()}</p>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={reset}>Place another order</Button>
          </CardFooter>
        </Card>
      )}

      {phase.kind === "order-placed" && (
        <Card>
          <CardHeader>
            <CardTitle>Order is processing</CardTitle>
            <CardDescription>
              {phase.serviceName} &middot; {phase.quantity.toLocaleString()} units &middot;{" "}
              <span className="font-mono break-all">{phase.targetLink}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Waiting for provider confirmation...
            </p>
          </CardContent>
        </Card>
      )}

      {(phase.kind === "idle" || phase.kind === "ordering") && (
        <Card>
          <CardHeader>
            <CardTitle>Order social boosting</CardTitle>
            <CardDescription>
              Pick a service and enter your target link. Prices include a {markup}% margin and are charged to your wallet
              when the order is placed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="platform" className="text-sm font-medium">Platform</label>
                <Select value={selectedPlatform} onValueChange={(v) => setSelectedPlatform(v ?? "all")}>
                  <SelectTrigger id="platform">
                    <SelectValue placeholder="All platforms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Platforms</SelectItem>
                    {platforms.map((p) => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.icon} {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="service" className="text-sm font-medium">Service</label>
                <Select value={selectedService} onValueChange={(v) => {
                  const code = v ?? ""
                  setSelectedService(code)
                  const svc = services.find((s) => s.serviceId === code)
                  if (svc) setQuantity(svc.minQty)
                }}>
                  <SelectTrigger id="service">
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {filteredServices.map((s) => (
                      <SelectItem key={s.serviceId} value={s.serviceId}>
                        {PLATFORM_ICONS[s.platform.toLowerCase()] ?? "🔌"} {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="search" className="text-sm font-medium">Search services</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name, platform, or type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="link" className="text-sm font-medium">Target link / username</label>
              <Input
                id="link"
                placeholder="https://www.instagram.com/username or @username"
                value={targetLink}
                onChange={(e) => setTargetLink(e.target.value)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="quantity" className="text-sm font-medium">Quantity</label>
                <Input
                  id="quantity"
                  type="number"
                  min={selectedServiceData?.minQty ?? 1}
                  max={selectedServiceData?.maxQty ?? 1000000}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
                {selectedServiceData && (
                  <p className="text-xs text-muted-foreground">
                    Min: {selectedServiceData.minQty.toLocaleString()} / Max: {selectedServiceData.maxQty.toLocaleString()}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Estimated cost</label>
                <div className="rounded-lg border bg-muted px-3 py-2 text-sm">
                  {rate > 0
                    ? `₦${estimatedCost.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "Select a service"}
                </div>
              </div>
            </div>

            {searchQuery && (
              <div className="max-h-64 overflow-y-auto rounded-lg border">
                <div className="grid gap-2 sm:grid-cols-2">
                  {filteredServices.map((s) => {
                    const p = prices[s.serviceId]
                    const isSelected = selectedService === s.serviceId
                    return (
                      <button
                        key={s.serviceId}
                        type="button"
                        onClick={() => {
                          setSelectedService(s.serviceId)
                          setQuantity(s.minQty)
                        }}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:bg-accent"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span aria-hidden>{PLATFORM_ICONS[s.platform.toLowerCase()] ?? "🔌"}</span>
                          <span className="truncate">{s.name}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {p !== undefined ? `₦${formatSmmPrice(p, markup, quantity)}` : "—"}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedServiceData
                ? `${selectedServiceData.name} • ${selectedServiceData.serviceType}`
                : "Choose a service to see details"}
            </span>
            <Button disabled={busy || !selectedService || !targetLink} onClick={handleOrder}>
              {busy ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <TrendingUp data-icon="inline-start" />
              )}
              {busy ? "Placing order..." : "Place order"}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
