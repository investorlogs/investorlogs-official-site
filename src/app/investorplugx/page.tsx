import Link from "next/link"

export default function InvestorPlugXPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0B0F19] px-6 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#0f172a_0%,_#0B0F19_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_#0f172a,_#02010a)] opacity-60" />

      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center gap-8 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-300">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]" />
          InvestorPlugX is Live
        </span>

        <h1 className="text-5xl font-black leading-tight tracking-tight sm:text-6xl md:text-7xl">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-200 via-slate-300 to-amber-400">
            InvestorPlugX
          </span>
        </h1>

        <p className="max-w-xl text-lg text-slate-300">
          Buy legit accounts with complete peace of mind.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/dashboard/accounts"
            className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_25px_8px_rgba(99,102,245,0.35)] transition-all hover:bg-indigo-500 hover:shadow-[0_0_35px_12px_rgba(99,102,245,0.55)]"
          >
            Browse Accounts
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/50 px-6 py-3 text-sm font-semibold text-slate-200 backdrop-blur-md transition-all hover:bg-slate-800/60"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}