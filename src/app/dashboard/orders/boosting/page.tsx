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
import { History, PackageOpen } from "lucide-react"
import Link from "next/link"

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
})

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "secondary",
  PROCESSING: "default",
  COMPLETED: "default",
  CANCELLED: "destructive",
  PARTIAL: "secondary",
}

export default async function BoostingOrdersPage() {
  const session = await requireSession("/dashboard/orders/boosting")

  const orders = await prisma.smmOrder.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  const totalSpent = orders.reduce((sum, order) => sum + order.price.toNumber(), 0)

  if (orders.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Boosting Orders</h2>
          <p className="text-muted-foreground">
            History of all social boosting orders placed from your wallet.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageOpen className="h-5 w-5 text-muted-foreground" />
              No boosting orders yet
            </CardTitle>
            <CardDescription>
              Orders you place for social boosting will appear here with their
              status and progress.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button render={<Link href="/dashboard/boosting" />}>
              Browse Boosting Services
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Boosting Orders</h2>
        <p className="text-muted-foreground">
          History of all social boosting orders placed from your wallet.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Order History</CardTitle>
            <CardDescription>
              {orders.length} order(s) — total spent ₦{totalSpent.toFixed(2)}
            </CardDescription>
          </div>
          <Button
            render={<Link href="/dashboard/boosting" />}
            variant="outline"
            size="sm"
          >
            <History className="h-4 w-4" />
            New Boost
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {order.serviceName ?? order.serviceId}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {order.serviceCategory ?? order.serviceId}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {order.targetLink}
                  </TableCell>
                  <TableCell>{order.quantity.toLocaleString()}</TableCell>
                  <TableCell>₦{order.price.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[order.status] ?? "outline"}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {dateFormatter.format(order.createdAt)} UTC
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
