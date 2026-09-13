import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/session"
import { PurchasedOrders, type PurchasedAccount } from "./orders-client"

export default async function AccountOrdersPage() {
  const session = await requireSession("/dashboard/orders/accounts")

  const accounts = await prisma.digitalAccount.findMany({
    where: { buyerId: session.user.id, status: "SOLD" },
    include: { category: { select: { name: true } } },
    orderBy: { purchasedAt: "desc" },
  })

  const orders: PurchasedAccount[] = accounts.map((account) => ({
    id: account.id,
    title: account.title,
    categoryName: account.category.name,
    price: account.price.toNumber(),
    purchasedAt: (account.purchasedAt ?? account.createdAt).toISOString(),
    credentials: account.credentials,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Purchased Accounts
        </h2>
        <p className="text-muted-foreground">
          Every account you have bought, with its credentials ready to copy or
          download.
        </p>
      </div>

      <PurchasedOrders orders={orders} />
    </div>
  )
}
