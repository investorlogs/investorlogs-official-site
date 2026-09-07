import { LinkButton } from "@/components/link-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-background font-sans">
      <main className="flex flex-1 w-full max-w-6xl flex-col items-center justify-center py-32 px-8">
        <div className="flex flex-col items-center gap-8 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-foreground">
            InvestorLogs
          </h1>
          <p className="max-w-2xl text-xl text-muted-foreground">
            Digital Asset Marketplace & Utility Platform
          </p>
          <p className="max-w-xl text-lg text-muted-foreground">
            Buy and sell digital accounts, SMS verification services, and social media marketing services
          </p>
        </div>

        <div className="flex flex-col gap-4 mt-8 sm:flex-row">
          <LinkButton href="/dashboard" size="lg">
            Go to Dashboard
          </LinkButton>
          <LinkButton href="/dashboard" variant="outline" size="lg">
            Browse Marketplace
          </LinkButton>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mt-16 w-full">
          <Card>
            <CardHeader>
              <CardTitle>Digital Accounts</CardTitle>
              <CardDescription>
                Buy and sell verified digital accounts securely
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Access premium accounts with instant delivery and secure transactions
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>SMS Verification</CardTitle>
              <CardDescription>
                Instant SMS verification codes for any service
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Get verification codes from real phone numbers worldwide
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>SMM Services</CardTitle>
              <CardDescription>
                Boost your social media presence
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                High-quality followers, likes, and engagement for all platforms
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
