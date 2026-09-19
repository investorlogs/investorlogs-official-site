"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Send, Bot, User, Loader2, AlertTriangle } from "lucide-react"

type Message = {
  role: "user" | "assistant"
  content: string
  escalated?: boolean
}

export function CareChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [offline, setOffline] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: text }])
    setLoading(true)

    try {
      const response = await fetch("/api/care/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      })

      if (!response.ok) {
        setOffline(true)
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "I couldn't reach the assistant. Please try again or email support@investorplugx.com with your order reference.",
          },
        ])
        return
      }

      const data = await response.json()
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          escalated: data.escalated,
        },
      ])
    } catch {
      setOffline(true)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Connection error. Please try again or email support@investorplugx.com.",
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Support</h2>
        <p className="text-muted-foreground">
          Get help with orders, your wallet or your account.
        </p>
      </div>

      <Card className="flex h-[600px] flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">InvestorLogs Assistant</CardTitle>
              <p className="text-xs text-muted-foreground">
                {offline ? "Offline" : "Online — here to help"}
              </p>
            </div>
          </div>
          <Badge variant={offline ? "destructive" : "secondary"} className="text-xs">
            {offline ? "No AI provider" : "AI powered"}
          </Badge>
        </CardHeader>

        <CardContent ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 p-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <Bot className="mb-2 h-10 w-10 opacity-40" />
              <p className="text-sm">
                Ask me anything — orders, wallet, SMS, boosting, or your account.
              </p>
              <p className="mt-1 text-xs">
                I can help you solve most issues yourself. For fraud or account
                issues I will escalate to our human team.
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 ${
                m.role === "user" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                {m.role === "user" ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : m.escalated
                      ? "border border-destructive/50 bg-destructive/10 text-destructive-foreground"
                      : "bg-muted"
                }`}
              >
                {m.escalated && (
                  <div className="mb-1 flex items-center gap-1 text-xs font-semibold">
                    <AlertTriangle className="h-3 w-3" />
                    Escalated to human support
                  </div>
                )}
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking...
              </div>
            </div>
          )}
        </CardContent>

        <div className="border-t p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about orders, wallet, SMS, or your account..."
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !input.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            For fraud, suspicious charges, or account compromise, the assistant
            will escalate you to human support at support@investorplugx.com.
          </p>
        </div>
      </Card>
    </div>
  )
}