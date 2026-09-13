"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { 
  LayoutDashboard, 
  ShoppingBag, 
  MessageSquare, 
  TrendingUp, 
  Wallet, 
  History, 
  PackageOpen,
  HelpCircle,
  LogOut
} from "lucide-react"
import { signOut } from "next-auth/react"

const navigation = [
  { name: "Dashboard Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Buy Accounts", href: "/dashboard/accounts", icon: ShoppingBag },
  { name: "Get SMS Numbers", href: "/dashboard/sms", icon: MessageSquare },
   { name: "Social Boosting", href: "/dashboard/boosting", icon: TrendingUp },
  { name: "Deposit", href: "/dashboard/wallet", icon: Wallet },
  { name: "Order History", href: "/dashboard/orders", icon: History },
  { name: "Purchased Accounts", href: "/dashboard/orders/accounts", icon: PackageOpen },
  { name: "Support", href: "/dashboard/support", icon: HelpCircle },
]

export function DashboardSidebar() {
  const pathname = usePathname()

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/auth/login" })
  }

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold">InvestorLogs</h1>
      </div>
      
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="border-t p-3">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>
    </div>
  )
}