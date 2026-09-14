import { NextResponse } from "next/server"
import {
  fetchLogCategory,
  isXclusivePlugsConfigured,
} from "@/lib/xclusivePlugs"
import { prisma } from "@/lib/prisma"
import { readFileSync } from "fs"
import { resolve } from "path"

/**
 * Cron-triggered XclusivePlugs catalog sync.
 *
 * Fetches live product list, prices, descriptions, and stock counts from the
 * XclusivePlugs Logs API and upserts them into the local AccountCategory /
 * DigitalAccount tables so the /dashboard/accounts page always reflects the
 * supplier's live availability.
 *
 * Schedule example:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://yoursite.com/api/cron/supplier-sync
 */
export async function GET(request: Request) {
  const secret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isXclusivePlugsConfigured()) {
    return NextResponse.json(
      { error: "XclusivePlugs API is not configured.", code: "NOT_CONFIGURED" },
      { status: 503 }
    )
  }

  const result: {
    success: boolean
    synced: number
    errors: string[]
    skipped: number
    /** Supplier-reported stock per slug. Informational only — nothing is stocked locally. */
    availableQuantity: Record<string, number>
  } = {
    success: true,
    synced: 0,
    errors: [],
    skipped: 0,
    availableQuantity: {},
  }

  let productMap: Record<string, number> = {}
  try {
    productMap = JSON.parse(
      readFileSync(resolve(process.cwd(), "config/productMap.json"), "utf-8")
    ) as Record<string, number>
  } catch {
    result.errors.push("config/productMap.json is missing or invalid.")
  }

  const slugs = Object.keys(productMap).filter((slug) => !slug.startsWith("_"))
  if (slugs.length === 0) {
    result.errors.push("config/productMap.json has no product slugs configured.")
  }

  for (const slug of slugs) {
    const productId = productMap[slug]
    if (typeof productId !== "number" || !Number.isFinite(productId)) {
      result.skipped++
      result.errors.push(`Slug "${slug}" has a non-numeric product id and was skipped.`)
      continue
    }

    try {
      const supplierCategory = await fetchLogCategory(productId)
      if (!supplierCategory) {
        result.skipped++
        result.errors.push(`Supplier category ${productId} (${slug}) returned no data.`)
        continue
      }

      const availableQty = Number(supplierCategory.available_quantity) || 0
      const name = supplierCategory.name ?? slug
      const description = supplierCategory.description ?? null

      await prisma.accountCategory.upsert({
        where: { slug },
        update: { name, description, updatedAt: new Date() },
        create: { slug, name, description },
      })

      // NOTE: this sync only mirrors categories. It deliberately does NOT
      // fabricate DigitalAccount rows: doing so put unresellable placeholder
      // stock in front of customers and, because the purchase route prices a
      // basket from these rows, it also mispriced orders (the supplier price is
      // per log, not per fabricated row). Real inventory is created at purchase
      // time from the supplier's actual delivered logs.
      //
      // `available_quantity` is therefore reported for visibility only.
      result.availableQuantity[slug] = availableQty

      result.synced++
    } catch (error) {
      result.skipped++
      result.errors.push(
        `Slug "${slug}" (productId ${productId}): ${error instanceof Error ? error.message : "unknown error"}`
      )
    }
  }

  result.success = result.errors.length === 0
  return NextResponse.json(result, { status: result.success ? 200 : 502 })
}