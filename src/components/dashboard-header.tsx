"use client"

import { useSession } from "next-auth/react"
import { ThemeToggle } from "@/components/theme-toggle"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"

export function DashboardHeader() {
  const { data: session, status } = useSession()

  const userInitials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U"

  return (
    <header className="border-b bg-card">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">IL</span>
            </div>
            <h1 className="text-lg font-semibold">InvestorLogs</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Wallet Balance Display */}
          {status === "authenticated" && (
            <Card className="px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Balance:</span>
                <span className="text-lg font-semibold">
                  ${session.user.walletBalance?.toFixed(2) || "0.00"}
                </span>
              </div>
            </Card>
          )}

          <ThemeToggle />

          <Avatar className="h-8 w-8">
            <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || "User"} />
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  )
}