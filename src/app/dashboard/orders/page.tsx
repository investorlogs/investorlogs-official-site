import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/session"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowDownLeft,
  ArrowUpRight,
  History,
  PackageOpen,
} from "lucide-react"

export default async function OrdersPage() {
  const session = await requireSession("/dashboard/orders")

  const transactions = await prisma.walletTransaction.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  const typeVariant: Record<string, "default" | "secondary" | "outline"> = {
    DEPOSIT: "default",
    PURCHASE: "secondary",
    REFUND: "outline",
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Order History</h2>
        <p className="text-muted-foreground">
          A unified log of your wallet activity across all marketplace
          modules.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/dashboard/orders/accounts" className="group">
          <Card className="h-full transition-colors group-hover:border-primary/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Purchased Accounts
              </CardTitle>
              <PackageOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                View, copy or download your bought credentials &rarr;
              </p>
            </CardContent>
          </Card>
        </Link>
        <Card className="h-full opacity-70">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SMS Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>
        <Link href="/dashboard/orders/boosting" className="group">
          <Card className="h-full transition-colors group-hover:border-primary/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">SMM Orders</CardTitle>
              <History className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                View your boosting order history &rarr;
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              Wallet Transactions
            </CardTitle>
            <CardDescription>
              Deposits, purchases and refunds (latest 50)
            </CardDescription>
          </div>
          <Button
            render={<Link href="/dashboard/wallet" />}
            variant="outline"
            size="sm"
          >
            Deposit
          </Button>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No transactions yet. Deposits and purchases will appear here.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const amount = tx.amount.toNumber()
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-muted-foreground">
                        {new Intl.DateTimeFormat("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "UTC",
                        }).format(tx.createdAt)}{" "}
                        UTC
                      </TableCell>
                      <TableCell>
                        <Badge variant={typeVariant[tx.type] ?? "outline"}>
                          {tx.type}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={
                          amount < 0
                            ? "font-medium text-destructive"
                            : "font-medium text-green-600 dark:text-green-400"
                        }
                      >
                        {amount < 0 ? (
                          <ArrowUpRight
                            data-icon="inline-start"
                            className="inline-block"
                          />
                        ) : (
                          <ArrowDownLeft
                            data-icon="inline-start"
                            className="inline-block"
                          />
                        )}
                        ₦{Math.abs(amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tx.status}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {tx.reference ?? "—"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
