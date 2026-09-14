import { LandingNavbar } from "@/components/landing-navbar"
import { LandingHero } from "@/components/landing-hero"
import { LandingServices } from "@/components/landing-services"
import { LandingFooter } from "@/components/landing-footer"
import { LandingNetwork } from "@/components/landing-network"

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-[#0B0F19] text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#0f172a_0%,_#0B0F19_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_#0f172a,_#02010a)] opacity-60" />
      <LandingNetwork />

      <LandingNavbar />

      <main className="relative z-10 flex w-full flex-1 flex-col items-center justify-center gap-20 px-6 pt-28">
        <LandingHero />
        <LandingServices />
      </main>

      <LandingFooter initialSmsSent={4287} initialAccountsReady={12054} />
    </div>
  )
}