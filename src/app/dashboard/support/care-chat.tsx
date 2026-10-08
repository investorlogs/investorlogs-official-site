"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageCircle, ExternalLink } from "lucide-react"

const TELEGRAM_URL = "https://t.me/Investorlogs1"

export function CareChat() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Support</h2>
        <p className="text-muted-foreground">Get help with orders, your wallet or your account.</p>
      </div>
      <Card className="flex flex-col items-center py-12 text-center">
        <CardHeader className="flex flex-col items-center space-y-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <MessageCircle className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">Chat with us on Telegram</CardTitle>
          <p className="max-w-md text-sm text-muted-foreground">Our support team replies fastest on Telegram. Tap the button below to open our chat in a new tab.</p>
        </CardHeader>
        <CardContent>
          <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80">Open Telegram Support<ExternalLink className="ml-1 h-4 w-4" /></a>
          <p className="mt-4 text-xs text-muted-foreground">For fraud, suspicious charges, or account compromise, message us on Telegram with your order reference.</p>
        </CardContent>
      </Card>
    </div>
  )
}


