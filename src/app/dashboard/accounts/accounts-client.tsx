"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Boxes, ShoppingCart, Copy, CheckCheck, Eye, EyeOff } from "lucide-react"
import {
  FaFacebook,
  FaInstagram,
  FaTwitter,
  FaYoutube,
  FaLinkedin,
  FaTelegram,
  FaApple,
  FaTiktok,
  FaReddit,
  FaGlobe,
  FaEnvelope,
  FaServer,
} from "react-icons/fa"
import { FlagIcon } from "@/components/flag-icon"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export interface StoreCategory {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  countryCode: string | null
  stock: number
  fromPrice: number | null
}

interface FilterTab {
  slug: string
  name: string
  count: number
  stock: number
}

const MAX_QTY_OPTION = 10

const SLUG_TO_LABEL: Record<string, string> = {
  "facebook": "Facebook",
  "instagram": "Instagram",
  "twitter/x": "Twitter/X",
  "tiktok": "TikTok",
  "reddit": "Reddit",
  "icloud": "iCloud",
  "9proxy": "9proxy",
  "hotmail": "Hotmail",
  "outlook": "Outlook",
  "cliproxy": "CLIPROXY",
}

interface PlatformBadge {
  icon: React.ReactNode
  bg: string
  fg: string
}

function resolvePlatformBadge(name: string | null | undefined, slug: string | null | undefined): PlatformBadge {
  const text = `${name ?? ""} ${slug ?? ""}`.toLowerCase()

  if (text.includes("facebook")) {
    return {
      icon: <FaFacebook className="h-5 w-5" />,
      bg: "#1877F2",
      fg: "#ffffff",
    }
  }
  if (text.includes("instagram")) {
    return {
      icon: <FaInstagram className="h-5 w-5" />,
      bg: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
      fg: "#ffffff",
    }
  }
  if (text.includes("twitter") || text.includes(" x")) {
    return {
      icon: <FaTwitter className="h-5 w-5" />,
      bg: "#000000",
      fg: "#ffffff",
    }
  }
  if (text.includes("tiktok")) {
    return {
      icon: <FaTiktok className="h-5 w-5" />,
      bg: "#010101",
      fg: "#ffffff",
    }
  }
  if (text.includes("youtube")) {
    return {
      icon: <FaYoutube className="h-5 w-5" />,
      bg: "#FF0000",
      fg: "#ffffff",
    }
  }
  if (text.includes("reddit")) {
    return {
      icon: <FaReddit className="h-5 w-5" />,
      bg: "#FF4500",
      fg: "#ffffff",
    }
  }
  if (text.includes("telegram")) {
    return {
      icon: <FaTelegram className="h-5 w-5" />,
      bg: "#0088cc",
      fg: "#ffffff",
    }
  }
  if (text.includes("linkedin")) {
    return {
      icon: <FaLinkedin className="h-5 w-5" />,
      bg: "#0A66C2",
      fg: "#ffffff",
    }
  }
  if (text.includes("icloud") || text.includes("apple")) {
    return {
      icon: <FaApple className="h-5 w-5" />,
      bg: "#000000",
      fg: "#ffffff",
    }
  }
  if (text.includes("9proxy")) {
    return {
      icon: <FaGlobe className="h-5 w-5" />,
      bg: "#1a1a1a",
      fg: "#ffffff",
    }
  }
  if (text.includes("hotmail")) {
    return {
      icon: <FaEnvelope className="h-5 w-5" />,
      bg: "#0078D4",
      fg: "#ffffff",
    }
  }
  if (text.includes("outlook")) {
    return {
      icon: <FaEnvelope className="h-5 w-5" />,
      bg: "#0078D4",
      fg: "#ffffff",
    }
  }
  if (text.includes("cliproxy")) {
    return {
      icon: <FaServer className="h-5 w-5" />,
      bg: "#2d2d2d",
      fg: "#ffffff",
    }
  }

  return {
    icon: <Boxes className="h-5 w-5 text-muted-foreground" />,
    bg: "hsl(var(--muted))",
    fg: "hsl(var(--muted-foreground))",
  }
}

export function AccountsStore({ categories }: { categories: StoreCategory[] }) {
  const router = useRouter()
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [purchasingId, setPurchasingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [lastCredentials, setLastCredentials] = useState<string | null>(null)
  const [credentialsRevealed, setCredentialsRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  // Filter by platform slug (supplier items share a slug per platform).
  const visibleCategories = activeFilter
    ? categories.filter((category) => category.slug === activeFilter)
    : categories

  const facebookProducts = categories.filter((c) => c.slug === "facebook")
  console.log("Total Facebook items rendered:", facebookProducts.length)

  // Build the set of platform filter tabs from the live data.
  const filterTabs: FilterTab[] = Array.from(
    new Set(categories.map((category) => category.slug).filter(Boolean))
  )
    .sort()
    .map((slug) => {
      const count = categories.filter((c) => c.slug === slug).length
      return {
        slug,
        name: SLUG_TO_LABEL[slug] ?? slug,
        count,
        stock: categories.find((c) => c.slug === slug)?.stock ?? 0,
      }
    })

  const handlePurchase = async (category: StoreCategory) => {
    setPurchasingId(category.id)
    setError(null)
    setSuccess(null)
    setLastCredentials(null)
    setCredentialsRevealed(false)
    setCopied(false)

    try {
      const response = await fetch("/api/accounts/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountCategoryId: category.id,
          quantity: quantities[category.id] ?? 1,
        }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setError(data?.error ?? "Purchase failed. Please try again.")
        return
      }

      setLastCredentials(data.order?.credentials ?? null)
      setSuccess(
        `${data.message} New balance: ₦${data.order.newBalance.toFixed(2)}.`
      )
      router.refresh()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setPurchasingId(null)
    }
  }

  const handleCopyCredentials = async () => {
    if (!lastCredentials) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(lastCredentials)
      } else {
        const ta = document.createElement("textarea")
        ta.value = lastCredentials
        ta.style.position = "fixed"
        ta.style.opacity = "0"
        document.body.appendChild(ta)
        ta.select()
        document.execCommand("copy")
        ta.remove()
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      {/* Category filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={activeFilter === null ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveFilter(null)}
        >
          All Categories
        </Button>
        {filterTabs.map((tab) => (
          <Button
            key={tab.slug}
            variant={activeFilter === tab.slug ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter(tab.slug)}
          >
            {tab.name}
            <span className="text-xs opacity-70">
              ({tab.count})
            </span>
          </Button>
        ))}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertDescription>
            {success}{" "}
            <Link
              href="/dashboard/orders/accounts"
              className="font-medium underline underline-offset-4"
            >
              View purchased accounts
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {lastCredentials && (
        <Card>
          <CardHeader>
            <CardTitle>Account Credentials</CardTitle>
            <CardDescription>
              Your purchased account logs are ready. Copy or download them below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCredentialsRevealed((prev) => !prev)}
              >
                {credentialsRevealed ? (
                  <EyeOff data-icon="inline-start" />
                ) : (
                  <Eye data-icon="inline-start" />
                )}
                {credentialsRevealed ? "Hide" : "View"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCredentials}
              >
                {copied ? (
                  <CheckCheck data-icon="inline-start" />
                ) : (
                  <Copy data-icon="inline-start" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            {credentialsRevealed && (
              <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                {lastCredentials}
              </pre>
            )}
          </CardContent>
        </Card>
      )}

      {/* Account cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visibleCategories.map((category) => {
          const quantity = quantities[category.id] ?? 1
          const maxQty = Math.max(1, Math.min(category.stock, MAX_QTY_OPTION))
          const isPurchasing = purchasingId === category.id
          const isOutOfStock = category.stock === 0

          return (
            <Card key={category.id} className="flex flex-col h-full">
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between">
                  {(() => {
                    const badge = resolvePlatformBadge(category.name, category.slug)
                    return (
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
                        style={{ backgroundColor: badge.bg }}
                      >
                        {badge.icon}
                      </div>
                    )
                  })()}
                  {isOutOfStock ? (
                    <Badge variant="destructive">Out of stock</Badge>
                  ) : (
                    <Badge variant="secondary">{category.stock} in stock</Badge>
                  )}
                </div>
                <div className="flex items-start gap-2">
                  {category.countryCode && (
                    <FlagIcon countryCode={category.countryCode} title={category.countryCode.toUpperCase()} />
                  )}
                  <CardTitle className="min-w-0 flex-1 break-words whitespace-normal line-clamp-none">
                    {category.name}
                  </CardTitle>
                </div>
                <CardDescription className="whitespace-pre-wrap break-words">
                  {category.description ?? "Ready-made account payload"}
                </CardDescription>
              </CardHeader>
      <CardContent className="flex-1">
        <div className="text-2xl font-bold">
          {category.fromPrice !== null
            ? `₦${(category.fromPrice as number).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : "—"}
          {category.fromPrice !== null && category.stock > 1 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              / account
            </span>
          )}
        </div>
      </CardContent>
              <CardFooter className="flex items-center gap-2">
                <select
                  aria-label={`Quantity of ${category.name} accounts`}
                  value={quantity}
                  disabled={isOutOfStock || isPurchasing}
                  onChange={(event) =>
                    setQuantities((prev) => ({
                      ...prev,
                      [category.id]: Number(event.target.value),
                    }))
                  }
                  className="h-8 rounded-lg border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
                >
                  {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <Button
                  className="flex-1"
                  disabled={isOutOfStock || isPurchasing}
                  onClick={() => handlePurchase(category)}
                >
                  <ShoppingCart data-icon="inline-start" />
                  {isPurchasing ? "Processing..." : "Purchase"}
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>

      {visibleCategories.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No account categories are available yet. Check back soon.
          </CardContent>
        </Card>
      )}

    </div>
  )
}
