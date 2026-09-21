"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  RiDiscordFill,
  RiInstagramFill,
  RiTwitterXFill,
  RiNetflixFill,
  RiRedditFill,
} from "react-icons/ri"
import { Zap } from "lucide-react"

interface LandingFooterProps {
  initialSmsSent: number
  initialAccountsReady: number
}

function DashboardSnapshot() {
  return (
    <div className="relative flex h-10 w-[96px] items-end justify-center overflow-hidden rounded-md bg-slate-900/70 ring-1 ring-slate-700/60 shadow-[0_0_12px_rgba(99,102,245,0.25)]">
      <svg viewBox="0 0 96 40" className="h-full w-full" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="snapGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4ade80" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M4 34 L12 22 L22 28 L32 14 L44 26 L56 12 L68 28 L80 16 L92 30 L92 36 L4 36 Z"
          fill="url(#snapGrad)"
        />
        <polyline
          points="4,34 12,22 22,28 32,14 44,26 56,12 68,28 80,16 92,30"
          fill="none"
          stroke="#4ade80"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

function FloatingAppIcon({ icon, delay }: { icon: React.ReactNode; delay: string }) {
  return (
    <div
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800/50 ring-1 ring-slate-700/50 shadow-[0_0_15px_-2px_rgba(99,102,245,0.3)] backdrop-blur-sm animate-float"
      style={{ animationDelay: delay }}
    >
      <span className="h-5 w-5 text-indigo-300 drop-shadow-[0_0_6px_rgba(99,102,245,0.4)]">{icon}</span>
    </div>
  )
}

export function LandingFooter({ initialSmsSent, initialAccountsReady }: LandingFooterProps) {
  const [smsSent, setSmsSent] = useState(initialSmsSent)
  const [accountsReady, setAccountsReady] = useState(initialAccountsReady)

  useEffect(() => {
    const smsInterval = setInterval(() => {
      setSmsSent((prev) => prev + Math.floor(Math.random() * 3) + 1)
    }, 4000)

    const accountsInterval = setInterval(() => {
      setAccountsReady((prev) => prev + Math.floor(Math.random() * 5) + 2)
    }, 3000)

    return () => {
      clearInterval(smsInterval)
      clearInterval(accountsInterval)
    }
  }, [])

  return (
    <footer className="relative z-10 flex w-full flex-col items-center justify-between gap-6 border-t border-slate-800/50 px-6 py-6 sm:flex-row">
      <div className="flex flex-wrap items-center justify-center gap-3 gap-x-5 sm:justify-start">
        <Link
          href="/refund-policy"
          className="text-sm text-slate-400 transition-colors hover:text-slate-200"
        >
          Refund Policy
        </Link>
        <Link
          href="/privacy-policy"
          className="text-sm text-slate-400 transition-colors hover:text-slate-200"
        >
          Privacy Policy
        </Link>
        <Link
          href="/terms-of-service"
          className="text-sm text-slate-400 transition-colors hover:text-slate-200"
        >
          Terms of Service
        </Link>
        <Link
          href="/dashboard/support"
          className="text-sm text-slate-400 transition-colors hover:text-slate-200"
        >
          Support
        </Link>
      </div>

      <div className="flex items-center justify-center sm:justify-start">
        <RiDiscordFill
          className="h-6 w-6 text-indigo-400 drop-shadow-[0_0_10px_rgba(99,102,245,0.5)]"
          aria-label="Discord"
        />
      </div>

      <div className="flex items-center gap-3">
        <DashboardSnapshot />
        <RiRedditFill
          className="h-5 w-5 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]"
          aria-label="Reddit"
        />
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center -space-x-3">
          <FloatingAppIcon icon={<RiDiscordFill />} delay="0s" />
          <FloatingAppIcon icon={<RiInstagramFill />} delay="0.2s" />
          <FloatingAppIcon icon={<RiTwitterXFill />} delay="0.4s" />
          <FloatingAppIcon icon={<RiNetflixFill />} delay="0.6s" />
        </div>

        <div className="flex items-center gap-1.5 text-slate-200">
          <Zap className="h-4 w-4 text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.6)]" aria-hidden="true" />
          <span className="text-sm font-medium">SMS Sent: {smsSent.toLocaleString()}</span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-200">
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.7)] animate-pulse"
            aria-hidden="true"
          />
          <span className="text-sm font-medium">Accounts Ready: {accountsReady.toLocaleString()}</span>
        </div>
      </div>
    </footer>
  )
}