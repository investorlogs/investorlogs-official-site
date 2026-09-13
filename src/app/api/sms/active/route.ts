import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { serializeSmsOrder } from "@/lib/sms-orders"

export const dynamic = "force-dynamic"

/**
 * Returns the user's in-flight (PENDING) SMS order, if any, so the
 * dashboard can resume the countdown and polling after a page refresh.
 * A just-completed (RECEIVED) order is returned too, so an already-arrived
 * code survives a refresh instead of prompting a second rental.
 */
export async function GET() {
  const session = await getSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const order = await prisma.smsOrder.findFirst({
    where: {
      userId: session.user.id,
      status: { in: ["PENDING", "RECEIVED"] },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ order: order ? serializeSmsOrder(order) : null })
}
