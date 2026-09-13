import { NextResponse } from "next/server"
import {
  fetchLogCategory,
  isXclusivePlugsConfigured,
} from "@/lib/xclusivePlugs"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
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

  const result = {
    success: true,
    synced: 0,
    created: 0,
    errors: [] as string[],
    skipped: 0,
  }

  let productMap: Record<string, number> = {}
  try {
    productMap = JSON.parse(
      readFileSync(resolve(process.cwd(), "config/productMap.json"), "utf-8")
    ) as Record<string, number>
  } catch {
    result.errors.push("config/productMap.json is missing or invalid.")
  }

  const slugs = Object.keys(productMap)
  if (slugs.length === 0) {
    result.errors.push("config/productMap.json is empty.")
  }

  for (const slug of slugs) {
    const productId = productMap[slug]
    try {
      const supplierCategory = await fetchLogCategory(productId)
      if (!supplierCategory) {
        result.skipped++
        result.errors.push(`Supplier category ${productId} (${slug}) returned no data.`)
        continue
      }

      const price = Number(supplierCategory.price) || 0
      const availableQty = Number(supplierCategory.available_quantity) || 0
      const name = supplierCategory.name ?? slug
      const description = supplierCategory.description ?? null

      const existing = await prisma.accountCategory.upsert({
        where: { slug },
        update: { name, description, updatedAt: new Date() },
        create: { slug, name, description },
      })

      const currentStock = await prisma.digitalAccount.count({
        where: { categoryId: existing.id, status: "AVAILABLE" },
      })

      if (currentStock < availableQty) {
        const deficit = availableQty - currentStock
        const baseTitle = `${name} Account`
        await prisma.digitalAccount.createMany({
          data: Array.from({ length: deficit }, (_, index) => ({
            categoryId: existing.id,
            title: `${baseTitle} #${String(index + 1).padStart(3, "0")}`,
            price: new Prisma.Decimal(price.toFixed(2)),
            credentials: `supplier-${productId}-placeholder-${crypto.randomUUID()}`,
            status: "AVAILABLE",
          })),
        })
        result.created += deficit
      }

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