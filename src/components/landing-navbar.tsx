import Link from "next/link"
import { User } from "lucide-react"

export function LandingNavbar() {
  return (
    <nav className="fixed top-0 right-0 z-40 flex items-center gap-3 p-6 pr-8">
      <Link
        href="/investorplugx"
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-700/60 bg-slate-900/40 px-4 py-2 text-sm font-medium text-slate-200 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-amber-400/50 hover:text-amber-300"
      >
        <span>InvestorPlugX</span>
      </Link>
      <Link
        href="/auth/login"
        className="relative inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-transparent bg-slate-900/55 px-4.5 py-2 text-sm font-medium text-slate-200 backdrop-blur-md [border-image:linear-gradient(135deg,theme(colors.indigo.500)_0%,theme(colors.amber.400)_50%,theme(colors.indigo.500)_100%)_1] shadow-[0_0_18px_rgba(99,102,245,0.25)] transition-all hover:-translate-y-0.5 hover:bg-slate-800/60 hover:shadow-[0_0_24px_rgba(99,102,245,0.4)]"
      >
        <User className="h-4 w-4 text-slate-300" aria-hidden="true" />
        <span>Sign In / Login</span>
      </Link>
    </nav>
  )
}