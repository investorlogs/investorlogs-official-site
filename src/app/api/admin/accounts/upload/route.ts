import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { adminAccountUploadSchema } from "@/lib/validations/accounts"

/**
 * Admin inventory upload for the accounts storefront.
 *
 * Accepts bulk account credentials in text/lines format — one line equals one
 * DigitalAccount record — and bulk-inserts them under a specific category.
 * Duplicate lines within the batch and credentials already stored in the same
 * category are skipped so the same payload is never stocked twice.
 */

const MAX_LINES_PER_UPLOAD = 1000
const MAX_LINE_LENGTH = 2000

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: admin access required" },
        { status: 403 }
      )
    }

    const { categoryId, price, titlePrefix, credentialsText } =
      adminAccountUploadSchema.parse(await request.json())

    const category = await prisma.accountCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true },
    })

    if (!category) {
      return NextResponse.json(
        { error: "Account category not found" },
        { status: 404 }
      )
    }

    // Parse lines format: one non-empty line = one account payload
    const lines = credentialsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    if (lines.length === 0) {
      return NextResponse.json(
        { error: "No credential lines found. Provide one account per line." },
        { status: 400 }
      )
    }

    if (lines.length > MAX_LINES_PER_UPLOAD) {
      return NextResponse.json(
        {
          error: `Too many lines: ${lines.length}. Maximum is ${MAX_LINES_PER_UPLOAD} per upload.`,
        },
        { status: 400 }
      )
    }

    const tooLong = lines.findIndex((line) => line.length > MAX_LINE_LENGTH)
    if (tooLong !== -1) {
      return NextResponse.json(
        {
          error: `Line ${tooLong + 1} exceeds the maximum length of ${MAX_LINE_LENGTH} characters.`,
        },
        { status: 400 }
      )
    }

    // De-duplicate within the uploaded batch
    const seen = new Set<string>()
    const uniqueLines: string[] = []
    let duplicatesInBatch = 0

    for (const line of lines) {
      if (seen.has(line)) {
        duplicatesInBatch++
        continue
      }
      seen.add(line)
      uniqueLines.push(line)
    }

    // Skip credentials already stocked in this category
    const existing = await prisma.digitalAccount.findMany({
      where: { categoryId, credentials: { in: uniqueLines } },
      select: { credentials: true },
    })
    const existingSet = new Set(existing.map((row) => row.credentials))
    const toCreate = uniqueLines.filter((line) => !existingSet.has(line))
    const duplicatesInDb = uniqueLines.length - toCreate.length

    let created = 0

    if (toCreate.length > 0) {
      const baseTitle = titlePrefix?.trim() || `${category.name} Account`

      const uploadResult = await prisma.digitalAccount.createMany({
        data: toCreate.map((credentials, index) => ({
          categoryId,
          title: `${baseTitle} #${String(index + 1).padStart(3, "0")}`,
          price: new Prisma.Decimal(price),
          credentials,
          status: "AVAILABLE",
        })),
      })

      created = uploadResult.count
    }

    return NextResponse.json(
      {
        message: `Upload complete: ${created} account(s) added to "${category.name}".`,
        summary: {
          category: category.name,
          linesReceived: lines.length,
          created,
          duplicatesInBatch,
          duplicatesInDb,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Admin account upload error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
