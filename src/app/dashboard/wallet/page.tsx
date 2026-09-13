import { requireSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { WalletClient } from "@/app/dashboard/wallet/wallet-client"

export const dynamic = "force-dynamic"

interface WalletTx {
  id: string
  amount: number
  type: string
  status: string
  reference: string | null
  createdAt: string
  updatedAt: string
}

export default async function WalletPage() {
  const session = await requireSession("/dashboard/wallet")
  const userId = session.user.id

  const [transactions, user] = await prisma.$transaction([
    prisma.walletTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true },
    }),
  ])

  const tx: WalletTx[] = transactions.map((t) => ({
    id: t.id,
    amount: t.amount.toNumber(),
    type: t.type,
    status: t.status,
    reference: t.reference,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }))

  return (
    <WalletClient
      initialBalance={user?.walletBalance.toNumber() ?? 0}
      initialTransactions={tx}
    />
  )
}
