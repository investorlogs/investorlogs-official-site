import {
  SiFacebook,
  SiInstagram,
  SiSignal,
  SiTiktok,
  SiWhatsapp,
} from "react-icons/si"
import type { SVGProps } from "react"

/**
 * Plenty of Fish has no Simple Icons entry, so we draw a minimal
 * flat fish mark in the brand's pink to match the other glyphs.
 */
function PofIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true" {...props}>
      <path d="M2.5 12c2.6-3.6 6-5.5 9.8-5.5 1.5 0 2.9.3 4.2.9l4.5-2.1-.9 3.4c.5 1 .8 2.1.8 3.3s-.3 2.3-.8 3.3l.9 3.4-4.5-2.1c-1.3.6-2.7.9-4.2.9-3.8 0-7.2-1.9-9.8-5.5Zm8.3-2.4a1.15 1.15 0 1 0 0 2.3 1.15 1.15 0 0 0 0-2.3Z" />
    </svg>
  )
}

interface SocialItem {
  label: string
  href: string
  glow: string
  ring: string
  icon: React.ReactNode
}

const SOCIALS: SocialItem[] = [
  {
    label: "Facebook",
    href: "/dashboard/accounts",
    glow: "0 0 18px 2px rgba(24,119,242,0.65), 0 0 42px 6px rgba(24,119,242,0.25)",
    ring: "rgba(24,119,242,0.8)",
    icon: <SiFacebook className="h-6 w-6 text-[#1877F2]" aria-hidden="true" />,
  },
  {
    label: "Instagram",
    href: "/dashboard/accounts",
    glow: "0 0 18px 2px rgba(228,64,95,0.6), 0 0 42px 6px rgba(188,24,136,0.28)",
    ring: "rgba(228,64,95,0.75)",
    icon: <SiInstagram className="h-6 w-6 text-[#E4405F]" aria-hidden="true" />,
  },
  {
    label: "WhatsApp",
    href: "/dashboard/sms",
    glow: "0 0 18px 2px rgba(37,211,102,0.65), 0 0 42px 6px rgba(37,211,102,0.25)",
    ring: "rgba(37,211,102,0.8)",
    icon: <SiWhatsapp className="h-6 w-6 text-[#25D366]" aria-hidden="true" />,
  },
  {
    label: "Signal",
    href: "/dashboard/sms",
    glow: "0 0 18px 2px rgba(58,118,240,0.65), 0 0 42px 6px rgba(58,118,240,0.25)",
    ring: "rgba(58,118,240,0.8)",
    icon: <SiSignal className="h-6 w-6 text-[#3A76F0]" aria-hidden="true" />,
  },
  {
    label: "Plenty of Fish",
    href: "/dashboard/accounts",
    glow: "0 0 18px 2px rgba(255,77,141,0.65), 0 0 42px 6px rgba(255,77,141,0.25)",
    ring: "rgba(255,77,141,0.8)",
    icon: <PofIcon className="h-6 w-6 text-[#FF4D8D]" />,
  },
  {
    label: "TikTok",
    href: "/dashboard/accounts",
    glow: "0 0 18px 2px rgba(0,242,234,0.55), 0 0 42px 6px rgba(254,44,85,0.30)",
    ring: "rgba(0,242,234,0.7)",
    icon: <SiTiktok className="h-6 w-6 text-slate-100" aria-hidden="true" />,
  },
]

export function LandingSocialRow() {
  return (
    <div
      className="flex items-center justify-center gap-3 sm:gap-4"
      role="list"
      aria-label="Marketplace platforms"
    >
      {SOCIALS.map((item) => (
        <a
          key={item.label}
          href={item.href}
          role="listitem"
          aria-label={item.label}
          title={item.label}
          className="group flex h-12 w-12 items-center justify-center rounded-2xl border bg-slate-900/70 backdrop-blur-md transition-transform duration-300 hover:-translate-y-1 hover:scale-105 sm:h-14 sm:w-14"
          style={{ borderColor: item.ring, boxShadow: item.glow }}
        >
          <span className="transition-transform duration-300 group-hover:scale-110">
            {item.icon}
          </span>
        </a>
      ))}
    </div>
  )
}
