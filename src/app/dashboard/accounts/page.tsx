import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/session"
import {
  fetchAllLogCategories,
  fetchParentCategories,
  isMockProvider,
  isXclusivePlugsConfigured,
  mapPlatform,
  formatNaira,
  cleanTitle,
} from "@/lib/xclusivePlugs"
import type { XpLogCategory } from "@/lib/xclusivePlugs"
import { AccountsStore, type StoreCategory } from "./accounts-client"

export const dynamic = "force-dynamic"

const ALLOWED_PARENT_SLUGS = new Set([
  "facebook",
  "instagram",
  "twitter/x",
  "icloud",
  "reddit",
  "9proxy",
  "hotmail",
  "outlook",
  "cliproxy",
  "tiktok",
])

function normalizeCategorySlug(slug: string): string {
  const lower = slug.toLowerCase()
  if (lower === "apple") return "icloud"
  return lower
}

function detectCountryCode(title: string): string | null {
  const lower = title.toLowerCase()
  const twoLetter = lower.match(/\b([a-z]{2})\b/)?.[1]
  if (twoLetter) return twoLetter
  if (lower.includes("usa") || lower.includes("united states")) return "us"
  if (lower.includes("uk") || lower.includes("united kingdom")) return "gb"
  if (lower.includes("indonesia")) return "id"
  if (lower.includes("nigeria")) return "ng"
  if (lower.includes("france")) return "fr"
  if (lower.includes("germany")) return "de"
  if (lower.includes("vietnam")) return "vn"
  if (lower.includes("philippines")) return "ph"
  if (lower.includes("canada")) return "ca"
  if (lower.includes("india")) return "in"
  if (lower.includes("brazil")) return "br"
  if (lower.includes("mexico")) return "mx"
  if (lower.includes("thailand")) return "th"
  if (lower.includes("egypt")) return "eg"
  if (lower.includes("saudi")) return "sa"
  if (lower.includes("uae") || lower.includes("emirates")) return "ae"
  if (lower.includes("australia")) return "au"
  if (lower.includes("japan")) return "jp"
  if (lower.includes("china")) return "cn"
  if (lower.includes("korea")) return "kr"
  if (lower.includes("italy")) return "it"
  if (lower.includes("spain")) return "es"
  if (lower.includes("poland")) return "pl"
  if (lower.includes("netherlands")) return "nl"
  if (lower.includes("sweden")) return "se"
  if (lower.includes("switzerland")) return "ch"
  if (lower.includes("ireland")) return "ie"
  if (lower.includes("portugal")) return "pt"
  if (lower.includes("romania")) return "ro"
  if (lower.includes("bulgaria")) return "bg"
  if (lower.includes("greece")) return "gr"
  if (lower.includes("turkey")) return "tr"
  if (lower.includes("pakistan")) return "pk"
  if (lower.includes("bangladesh")) return "bd"
  if (lower.includes("sri")) return "lk"
  if (lower.includes("nepal")) return "np"
  if (lower.includes("cambodia")) return "kh"
  if (lower.includes("laos")) return "la"
  if (lower.includes("myanmar")) return "mm"
  if (lower.includes("malaysia")) return "my"
  if (lower.includes("singapore")) return "sg"
  return null
}

interface SupplierItem {
  id: number
  name: string
  countryCode: string | null
  description: string | null
  platform: string
  price: number
  stock: number
}

async function loadSupplierCatalog(): Promise<SupplierItem[]> {
  const useMock = isMockProvider()
  const hasKey = isXclusivePlugsConfigured()

  if (!useMock && !hasKey) return []

  // If mock provider, return mock data directly
  if (useMock) {
    try {
      const [, categories] = await Promise.all([
        fetchParentCategories().catch(() => null),
        fetchAllLogCategories({ perPage: 100 }).catch(() => null),
      ])
      if (!categories || categories.length === 0) return []
      return processCategories(categories)
    } catch (error) {
      console.error("Failed to fetch mock XclusivePlugs catalog:", error)
      return []
    }
  }

  // Real API configured - try it first, fall back to mock on failure
  try {
    const [, categories] = await Promise.all([
      fetchParentCategories().catch(() => null),
      fetchAllLogCategories({ perPage: 100 }).catch(() => null),
    ])

    if (!categories || categories.length === 0) {
      console.warn("XclusivePlugs API returned empty categories, falling back to mock")
      return loadMockCatalog()
    }

    return processCategories(categories)
  } catch (error) {
    console.error("Failed to fetch XclusivePlugs catalog, falling back to mock:", error)
    return loadMockCatalog()
  }
}

async function loadMockCatalog(): Promise<SupplierItem[]> {
  try {
    const [, categories] = await Promise.all([
      fetchParentCategories().catch(() => null),
      fetchAllLogCategories({ perPage: 100 }).catch(() => null),
    ])
    if (!categories || categories.length === 0) return []
    return processCategories(categories)
  } catch (error) {
    console.error("Failed to fetch mock XclusivePlugs catalog:", error)
    return []
  }
}

function processCategories(categories: XpLogCategory[]): SupplierItem[] {
  const ALLOWED_PARENT_SLUGS = new Set([
    "facebook",
    "instagram",
    "twitter/x",
    "icloud",
    "reddit",
    "9proxy",
    "hotmail",
    "outlook",
    "cliproxy",
    "tiktok",
  ])

  const items = categories
    .map((c) => {
      const id = Number(c.id)
      if (!Number.isFinite(id)) return null
      const platform = mapPlatform(c.name ?? "")
      if (!ALLOWED_PARENT_SLUGS.has(platform.toLowerCase())) {
        return null
      }
      const rawName = c.name ?? `Category ${id}`
      return {
        id,
        name: cleanTitle(rawName),
        countryCode: detectCountryCode(rawName),
        description: c.description ?? null,
        platform,
        price: Number(c.price) || 0,
        stock: Number(c.available_quantity) || 0,
      }
    })
    .filter((item): item is SupplierItem => item !== null)

  console.log("Xclusive Plugs Items:", items)

  const facebookItems = items.filter((item) => item.platform === "Facebook")
  console.log("X-CLUSIVE PLUGS Facebook items count:", facebookItems.length)
  for (const item of facebookItems) {
    console.log("X-CLUSIVE PLUGS Facebook item:", {
      id: item.id,
      name: item.name,
      price_ngn: item.price,
      stock: item.stock,
      description: item.description,
    })
  }

  return items
}

export default async function AccountsPage() {
  await requireSession("/dashboard/accounts")

  const [localCategories, stockByCategory, supplierItems] = await Promise.all([
    prisma.accountCategory.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.digitalAccount.groupBy({
      by: ["categoryId"],
      where: { status: "AVAILABLE" },
      _count: { _all: true },
      _min: { price: true },
    }),
    loadSupplierCatalog(),
  ])

  const stockMap = new Map(
    stockByCategory.map((entry) => [entry.categoryId, entry])
  )

  const localStore: StoreCategory[] = localCategories
  .filter((category) => ALLOWED_PARENT_SLUGS.has(normalizeCategorySlug(category.slug)))
  .map((category) => {
    const stock = stockMap.get(category.id)
    return {
      id: category.id,
      name: category.name,
      slug: normalizeCategorySlug(category.slug),
      description: category.description,
      icon: category.icon,
      countryCode: null,
      stock: stock?._count._all ?? 0,
      fromPrice: stock?._min.price ? stock?._min.price.toNumber() + 2000 : null,
    }
  })

  // Merge supplier items into the store list. Supplier items get a synthetic
  // slug derived from their platform so the purchase route can map them back
  // to the XclusivePlugs category ID via config/productMap.json.
  const supplierStore: StoreCategory[] = supplierItems.map((item) => ({
    id: `xp-${item.id}`,
    name: item.name,
    slug: item.platform.toLowerCase(),
    description: item.description,
    icon: platformIcon(item.platform),
    countryCode: item.countryCode,
    stock: item.stock,
    fromPrice: item.price > 0 ? item.price + 2000 : null,
  }))

  const allCategories = [...supplierStore, ...localStore]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Buy Accounts</h2>
        <p className="text-muted-foreground">
          Ready-made digital accounts delivered instantly to your order
          history after purchase.
          {isXclusivePlugsConfigured()
            ? ` Showing ${supplierItems.length} live listings from our supplier.`
            : ""}
        </p>
      </div>

      <AccountsStore categories={allCategories} />
    </div>
  )
}

function platformIcon(platform: string): string | null {
  switch (platform) {
    case "Facebook":
      return "f"
    case "Instagram":
      return "i"
    case "Twitter/X":
      return "x"
    case "TikTok":
      return "♪"
    case "YouTube":
      return "▶"
    case "Reddit":
      return "r"
    case "Telegram":
      return "✈"
    case "LinkedIn":
      return "in"
    case "iCloud":
      return "☁"
    case "9proxy":
      return "9"
    case "Hotmail":
      return "h"
    case "Outlook":
      return "o"
    case "CLIPROXY":
      return "c"
    default:
      return null
  }
}

export { formatNaira }