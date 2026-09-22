import Link from "next/link"

function TitleArrow() {
  return (
    <svg
      className="-ml-8 shrink-0 -mt-1 h-6 w-14"
      viewBox="0 0 56 24"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="taGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.8" />
        </linearGradient>
        <filter id="taGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <marker id="taArrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0 0 L6 3 L0 6 Z" fill="url(#taGrad)" />
        </marker>
      </defs>
      <path
        d="M4 18 C14 2, 26 2, 48 10"
        stroke="url(#taGrad)"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        filter="url(#taGlow)"
        marker-end="url(#taArrow)"
      />
    </svg>
  )
}

function TitleConnection() {
  return (
    <svg
      className="absolute inset-0 h-full w-full pointer-events-none"
      viewBox="0 0 100 100"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="tcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <path
        d="M54 38 C62 18, 68 22, 79 38"
        stroke="url(#tcGrad)"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeDasharray="2 2"
      />
    </svg>
  )
}

export function LandingHero() {
  return (
    <section className="relative flex w-full flex-col items-center justify-center gap-12 pt-28 text-center">
      <h1 className="relative flex items-center justify-center gap-0 text-5xl font-black sm:text-6xl md:text-7xl lg:text-8xl">
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-200 via-slate-300 to-amber-400">
          InvestorPlugX
        </span>
        <TitleConnection />
        <TitleArrow />
      </h1>

      <p className="max-w-xl text-center text-sm text-slate-300 md:text-base">
        Premium Accounts · Instant SMS · SME Growth
      </p>

      <div className="flex justify-center">
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_25px_8px_rgba(99,102,245,0.35)] transition-all hover:bg-indigo-500 hover:shadow-[0_0_35px_12px_rgba(99,102,245,0.55)] animate-pulse-glow"
        >
          Get Started
        </Link>
      </div>
    </section>
  )
}