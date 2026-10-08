"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  ShoppingBag,
  MessageSquare,
  Wallet,
  History,
  PackageOpen,
  HelpCircle,
  LogOut
} from "lucide-react"
import { signOut } from "next-auth/react"

const TELEGRAM_URL = "https://t.me/Investorlogs1"

const navigation = [
  { name: "Dashboard Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Buy Accounts", href: "/dashboard/accounts", icon: ShoppingBag },
  { name: "Get SMS Numbers", href: "/dashboard/sms", icon: MessageSquare },
  { name: "Deposit", href: "/dashboard/wallet", icon: Wallet },
  { name: "Order History", href: "/dashboard/orders", icon: History },
  { name: "Purchased Accounts", href: "/dashboard/orders/accounts", icon: PackageOpen },
]

export function DashboardSidebar() {
  const pathname = usePathname()

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/auth/login" })
  }

  const linkClass = (active: boolean) => cn(
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
  )

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold">InvestorPlugX</h1>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => (
          <Link key={item.name} href={item.href} className={linkClass(pathname === item.href)}>
            <item.icon className="h-5 w-5" />
            {item.name}
          </Link>
        ))}
        <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className={linkClass(false)}>
          <HelpCircle className="h-5 w-5" />
          Support
        </a>
      </nav>
      <div className="border-t p-3">
        <button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>
    </div>
  )
}
