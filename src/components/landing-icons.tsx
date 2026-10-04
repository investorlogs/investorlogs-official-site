"use client"

import type { SVGProps } from "react"

interface IconProps extends SVGProps<SVGSVGElement> {
  className?: string
}

export function PurchaseLogsIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <ellipse cx="12" cy="7" rx="3.5" ry="1.4" />
      <ellipse cx="12" cy="12" rx="3.5" ry="1.4" />
      <ellipse cx="12" cy="17" rx="3.5" ry="1.4" />
      <path d="M8.5 12h7M8.5 17h7" strokeWidth="1" opacity="0.5" />
      <text x="10" y="13.2" fontSize="7" fontWeight="700" fill="currentColor">$</text>
    </svg>
  )
}

export function SocialBoostingIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M4 9h8a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4H4z" />
      <circle cx="5" cy="7" r="1" fill="currentColor" opacity="0.6" />
      <rect x="16" y="13" width="2" height="7" rx="1" />
      <rect x="18" y="11" width="2" height="9" rx="1" />
      <rect x="20" y="9" width="2" height="11" rx="1" />
      <path d="M7 13l2-2 2 2" strokeWidth="1.2" opacity="0.7" />
    </svg>
  )
}

export function PurchaseNumberIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
      <circle cx="12" cy="11" r="3" />
      <path d="M9 11a3 3 0 1 0 6 0 3 3 0 0 0-6 0z" />
      <path d="M12 8v6M9 11h6" strokeWidth="1" opacity="0.5" />
    </svg>
  )
}

export function DashboardIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <rect x="4" y="7" width="16" height="11" rx="1.5" />
      <polyline points="6,15 9,11 12,15 15,10 17,13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 20.5h18v-1.5" strokeWidth="1.2" opacity="0.5" />
      <rect x="7" y="19" width="10" height="2" rx="1" />
    </svg>
  )
}