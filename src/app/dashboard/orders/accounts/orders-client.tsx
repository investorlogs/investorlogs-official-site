"use client"

import { Fragment, useState } from "react"
import Link from "next/link"
import {
  CheckCheck,
  Copy,
  Download,
  Eye,
  EyeOff,
  PackageOpen,
} from "lucide-react"

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

export interface PurchasedAccount {
  id: string
  title: string
  categoryName: string
  price: number
  purchasedAt: string
  credentials: string
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
})

async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the legacy path below
  }
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  try {
    return document.execCommand("copy")
  } catch {
    return false
  } finally {
    textarea.remove()
  }
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function PurchasedOrders({ orders }: { orders: PurchasedAccount[] }) {
  const [revealedId, setRevealedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const totalSpent = orders.reduce((sum, order) => sum + order.price, 0)

  const handleCopy = async (order: PurchasedAccount) => {
    const ok = await copyText(order.credentials)
    if (ok) {
      setCopiedId(order.id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const handleDownload = (order: PurchasedAccount) => {
    const slug = order.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
    downloadText(`${slug || "account"}-credentials.txt`, order.credentials)
  }

  const handleDownloadAll = () => {
    const content = orders
      .map(
        (order) =>
          `=== ${order.title} (${order.categoryName}) ===\n${order.credentials}`
      )
      .join("\n\n")
    downloadText("investorplugx-purchased-accounts.txt", content)
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageOpen className="h-5 w-5 text-muted-foreground" />
            No purchases yet
          </CardTitle>
          <CardDescription>
            Accounts you buy will appear here with their credentials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link href="/dashboard/accounts" />}>
            Browse the accounts store
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Order History</CardTitle>
          <CardDescription>
            {orders.length} account(s) purchased — total spent $
            {totalSpent.toFixed(2)}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={handleDownloadAll}>
          <Download data-icon="inline-start" />
          Download All
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Purchased</TableHead>
              <TableHead className="text-right">Credentials</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const isRevealed = revealedId === order.id
              const isCopied = copiedId === order.id

              return (
                <Fragment key={order.id}>
                  <TableRow>
                    <TableCell className="font-medium">{order.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{order.categoryName}</Badge>
                    </TableCell>
                    <TableCell>₦{order.price.toFixed(2)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {dateFormatter.format(new Date(order.purchasedAt))} UTC
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-expanded={isRevealed}
                          onClick={() =>
                            setRevealedId(isRevealed ? null : order.id)
                          }
                        >
                          {isRevealed ? (
                            <EyeOff data-icon="inline-start" />
                          ) : (
                            <Eye data-icon="inline-start" />
                          )}
                          {isRevealed ? "Hide" : "View"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopy(order)}
                        >
                          {isCopied ? (
                            <CheckCheck data-icon="inline-start" />
                          ) : (
                            <Copy data-icon="inline-start" />
                          )}
                          {isCopied ? "Copied" : "Copy"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(order)}
                        >
                          <Download data-icon="inline-start" />
                          Download
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {isRevealed && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                          {order.credentials}
                        </pre>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}


