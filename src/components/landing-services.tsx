import Link from "next/link"
import {
  PurchaseLogsIcon,
  SocialBoostingIcon,
  PurchaseNumberIcon,
  WorkingPicturesIcon,
  WorkingToolsIcon,
  DashboardIcon,
} from "@/components/landing-icons"

interface Service {
  icon: React.ReactNode
  title: string
  delay: string
  href: string
}

const services: Service[] = [
  { icon: <PurchaseLogsIcon />, title: "Purchase Logs", delay: "0s", href: "/dashboard/accounts" },
  { icon: <SocialBoostingIcon />, title: "Social Boosting", delay: "0.15s", href: "/dashboard/boosting" },
  { icon: <PurchaseNumberIcon />, title: "Purchase Number", delay: "0.3s", href: "/dashboard/sms" },
  { icon: <WorkingPicturesIcon />, title: "Working Pictures", delay: "0.45s", href: "/dashboard/accounts" },
  { icon: <WorkingToolsIcon />, title: "Working Tools", delay: "0.6s", href: "/dashboard/accounts" },
  { icon: <DashboardIcon />, title: "Dashboard", delay: "0.75s", href: "/dashboard" },
]

function ServiceCard({ icon, title, delay, href }: Service) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col items-center gap-3 rounded-[28px_28px_12px_12px] border border-slate-700/50 bg-slate-800/40 p-6 text-center backdrop-blur-sm shadow-[0_0_25px_-6px_rgba(99,102,245,0.12)] transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.03] hover:border-slate-600/60 hover:shadow-[0_0_35px_-6px_rgba(99,102,245,0.25)] animate-float cursor-pointer"
      style={{ animationDelay: delay }}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-400/20 transition-transform group-hover:scale-110">
        <span className="h-5 w-5">{icon}</span>
      </div>
      <h3 className="text-sm font-semibold text-slate-100 transition-colors group-hover:text-white">
        {title}
      </h3>
    </Link>
  )
}

export function LandingServices() {
  return (
    <section className="relative z-10 w-full">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {services.map((svc, i) => (
          <ServiceCard key={i} {...svc} />
        ))}
      </div>
    </section>
  )
}