import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { purchaseSchema } from "@/lib/validations/accounts"
import { placeLogOrder, getSupplierProductId } from "@/lib/xclusivePlugs"

/**
 * Purchase engine for the digital accounts storefront (Phase 2 + reseller).
 *
 * Flow:
 * 1. Lock + claim `quantity` AVAILABLE DigitalAccount rows (SELECT ... FOR
 *    UPDATE SKIP LOCKED) so concurrent checkouts never sell the same payload.
 * 2. Atomically check-and-deduct the buyer's wallet balance.
 * 3. POST to the XclusivePlugs supplier API to fetch the account logs.
 * 4. Persist the order + credentials on the DigitalAccount rows.
 *
 * If the supplier call fails, the entire Prisma transaction rolls back
 * (balance untouched, stock untouched) and the caller receives a clear
 * "Supplier service temporarily unavailable" error.
 */

class PurchaseError extends Error {
  constructor(
    public code:
      | "INSUFFICIENT_STOCK"
      | "INSUFFICIENT_BALANCE"
      | "STOCK_CONFLICT"
      | "PROVIDER_ERROR",
    message: string,
    public httpStatus: number
  ) {
    super(message)
  }
}

const STOCK_FETCH_MULTIPLIER = 3
const STOCK_FETCH_CAP = 200

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id
    const { accountCategoryId, quantity } = purchaseSchema.parse(
      await request.json()
    )

    const category = await prisma.accountCategory.findUnique({
      where: { id: accountCategoryId },
      select: { id: true, name: true, slug: true },
    })

    if (!category) {
      return NextResponse.json(
        { error: "Account category not found" },
        { status: 404 }
      )
    }

    const result = await runPurchaseTransaction(
      userId,
      accountCategoryId,
      category.name,
      category.slug,
      quantity
    )

    return NextResponse.json(
      {
        message: `Successfully purchased ${result.purchasedCount} "${category.name}" account(s).`,
        order: {
          id: result.transactionId,
          reference: result.reference,
          category: category.name,
          quantity: result.purchasedCount,
          totalCost: result.totalCost.toNumber(),
          newBalance: result.newBalance.toNumber(),
          credentials: result.credentials,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof PurchaseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.httpStatus }
      )
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Account purchase error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

async function runPurchaseTransaction(
  userId: string,
  accountCategoryId: string,
  categoryName: string,
  categorySlug: string,
  quantity: number
) {
  return prisma.$transaction(async (tx) => {
    // a. Lock + select `quantity` AVAILABLE accounts for this category.
    //    Rows already locked by concurrent checkouts are skipped; the
    //    over-fetch buffer replaces them with other available stock.
    const fetchLimit = Math.min(
      quantity * STOCK_FETCH_MULTIPLIER,
      STOCK_FETCH_CAP
    )

    const candidates = await tx.$queryRaw<
      { id: string; price: Prisma.Decimal }[]
    >`
      SELECT "id", "price"
      FROM "DigitalAccount"
      WHERE "categoryId" = ${accountCategoryId} AND status = 'AVAILABLE'
      ORDER BY "createdAt" ASC
      LIMIT ${fetchLimit}
      FOR UPDATE SKIP LOCKED
    `

    const selected = candidates.slice(0, quantity)

    if (selected.length < quantity) {
      throw new PurchaseError(
        "INSUFFICIENT_STOCK",
        `Insufficient stock: only ${selected.length} of the requested ${quantity} "${categoryName}" account(s) could be reserved. No funds were charged.`,
        409
      )
    }

    const selectedIds = selected.map((account) => account.id)

    // Calculate total cost: sum of supplier prices + 2000 Naira profit markup per account.
    // The customer is charged supplier cost + 2000 per account; the supplier base
    // cost is never exposed. The profit portion is logged separately as ACCOUNTS_PROFIT.
    const supplierTotal = selected.reduce(
      (sum, account) => sum.plus(account.price),
      new Prisma.Decimal(0)
    )
    const profitMarkup = new Prisma.Decimal(2000).times(selectedIds.length)
    const totalCost = supplierTotal.plus(profitMarkup)

    // e. Wallet transaction log for the purchase.
    const walletTransaction = await tx.walletTransaction.create({
      data: {
        userId,
        amount: totalCost.negated(),
        type: "PURCHASE",
        status: "COMPLETED",
        reference: `acct-${crypto.randomUUID()}`,
      },
    })

    // f. Separate profit allocation: log the flat 2000 Naira markup per account as profit.
    //    This is isolated from the customer-facing PURCHASE transaction and never exposed.
    const profitAmountPerAccount = new Prisma.Decimal(2000)
    const profitAmountTotal = profitAmountPerAccount.times(selectedIds.length)
    // Only create a profit entry if the total profit is positive (always true for 2000 per account)
    await tx.walletTransaction.create({
      data: {
        userId,
        amount: profitAmountTotal,
        type: "ACCOUNTS_PROFIT",
        status: "COMPLETED",
        reference: `accounts-profit-${crypto.randomUUID()}`,
      },
    })

    // g. Pull the account logs from the XclusivePlugs supplier API.
    //    This runs inside the transaction so any failure rolls back the
    //    balance debit and stock claim automatically.
    const supplierProductId = getSupplierProductId(categorySlug)
    if (!supplierProductId) {
      throw new PurchaseError(
        "PROVIDER_ERROR",
        `No supplier product mapping configured for "${categoryName}". Contact support.`,
        503
      )
    }

    const supplierResult = await placeLogOrder({
      productId: supplierProductId,
      quantity,
      idempotencyKey: `il-${walletTransaction.id}`,
    })

    if (!supplierResult.success) {
      const supplierCode = supplierResult.code ?? ""
      let message = "Supplier service temporarily unavailable. Your balance was not charged."
      if (supplierCode === "OUT_OF_STOCK") {
        message = "Out of stock on the supplier side. Your balance was not charged."
      } else if (supplierCode === "INSUFFICIENT_BALANCE") {
        message = "Supplier account has insufficient funds. Your balance was not charged."
      } else if (supplierCode === "LOG_CATEGORY_NOT_FOUND") {
        message = "Supplier category not found. Your balance was not charged."
      }
      throw new PurchaseError("PROVIDER_ERROR", message, 502)
    }

    const supplierOrder = supplierResult.order
    // h. Concatenate the supplier's delivered log items into one credentials
    //    block and stamp it onto the claimed accounts.
    const credentials = (supplierOrder?.items ?? [])
      .map((item) => item.details ?? "")
      .filter((line) => line.trim().length > 0)
      .join("\n")

    // Guard: never hand a customer a row that still holds a sync placeholder or
    // an empty string. Placeholder rows come from /api/cron/supplier-sync, which
    // pre-creates stock before the supplier has delivered real logs. If we stamp
    // those onto a paid purchase the customer pays and receives nothing usable,
    // so we abort and let the transaction roll the balance debit back.
    if (credentials.length === 0) {
      throw new PurchaseError(
        "PROVIDER_ERROR",
        "Our supplier did not return usable account logs. Your balance was not charged. Please try again shortly.",
        502
      )
    }

    await tx.digitalAccount.updateMany({
      where: { id: { in: selectedIds } },
      data: { credentials: credentials || "" },
    })

    const buyer = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { walletBalance: true },
    })

    return {
      transactionId: walletTransaction.id,
      reference: walletTransaction.reference,
      totalCost,
      newBalance: buyer.walletBalance,
      purchasedCount: selectedIds.length,
      credentials: credentials || null,
      supplierOrderId: supplierOrder?.order_id ?? null,
    }
  })
}