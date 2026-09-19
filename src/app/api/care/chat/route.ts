import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { buildCareSystemPrompt, needsEscalation, buildEscalationReply } from "@/lib/care"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const message: string = body?.message
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }
    if (message.length > 2000) {
      return NextResponse.json({ error: "Message is too long" }, { status: 400 })
    }

    // Escalation check runs before any AI call — fraud / account issues go to humans.
    if (needsEscalation(message)) {
      return NextResponse.json({ reply: buildEscalationReply(), escalated: true })
    }

    const [user, recentOrders] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { walletBalance: true },
      }),
      prisma.walletTransaction.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, type: true, status: true, amount: true },
      }),
    ])

    const systemPrompt = buildCareSystemPrompt({
      userId: session.user.id,
      walletBalance: user?.walletBalance?.toNumber() ?? undefined,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        type: o.type,
        status: o.status,
        total: o.amount.toNumber(),
      })),
    })

    const reply = await generateCareReply(systemPrompt, message.trim())

    return NextResponse.json({ reply, escalated: false })
  } catch (error) {
    console.error("Care chat error:", error)
    return NextResponse.json(
      { error: "Something went wrong. Please try again or contact support." },
      { status: 500 }
    )
  }
}

async function generateCareReply(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()

  if (!apiKey) {
    return (
      "I'm currently offline — no AI provider is configured. " +
      "In the meantime, you can solve most issues yourself:\n\n" +
      "- **Orders**: check Order History for status and references\n" +
      "- **Wallet**: your balance is shown in the sidebar\n" +
      "- **Account**: use 'Forgot your password?' on the login page\n\n" +
      "For anything else, email support@investorplugx.com with your order reference."
    )
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 600,
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      console.error("OpenAI error:", response.status, text)
      return "I'm having trouble reaching the assistant right now. Please try again in a moment, or contact support@investorplugx.com."
    }

    const data = await response.json()
    const reply = data?.choices?.[0]?.message?.content
    if (!reply || typeof reply !== "string") {
      return "I couldn't generate a response. Please try again or contact support@investorplugx.com."
    }

    return reply.trim()
  } catch (error) {
    console.error("Care chat network error:", error)
    return "I'm having trouble reaching the assistant right now. Please try again in a moment, or contact support@investorplugx.com."
  }
}