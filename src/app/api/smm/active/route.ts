import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { serializeSmmOrder } from "@/lib/smm-orders"

export const dynamic = "force-dynamic"

/**
 * Returns the user's in-flight (PENDING/PROCESSING) SMM order, if any, so the
 * dashboard can resume the countdown and polling after a page refresh.
 * A just-completed order is returned too, so an already-finished order survives
 * a refresh instead of prompting a second purchase.
 */
export async function GET() {
  const session = await getSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const order = await prisma.smmOrder.findFirst({
    where: {
      userId: session.user.id,
      status: { in: ["PENDING", "PROCESSING", "COMPLETED", "PARTIAL"] },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ order: order ? serializeSmmOrder(order) : null })
}
