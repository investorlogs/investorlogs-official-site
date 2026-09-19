import { prisma } from "@/lib/prisma"

/**
 * Customer care knowledge base — the source of truth the AI assistant answers from.
 * Keep this in sync with the real site behaviour. The assistant never invents
 * facts not present here.
 */
export const CARE_KB = {
  site: {
    name: "InvestorLogs",
    url: process.env.NEXTAUTH_URL ?? "https://investorplugx.com",
  },
  accounts: {
    howToBuy:
      "Go to Buy Accounts, pick a category, choose the quantity you want, and pay from your wallet balance. You receive the account logs instantly after payment.",
    prerequisites: "You need a funded wallet balance. Deposits are currently disabled — top up later when payments are enabled.",
    delivery: "Account logs are delivered instantly to your Order History after a successful purchase.",
    refunds: "If a purchase fails or the supplier does not deliver logs, your balance is refunded automatically and no stock is consumed.",
  },
  sms: {
    howToOrder: "Go to Get SMS Numbers, pick a country and service, and order from your wallet balance. You receive a temporary phone number and the verification code.",
    pricing: "Prices are shown per order. A profit markup is added to the supplier cost.",
    status: "Order status updates from PENDING to RECEIVED when the code arrives. You can check status anytime in Order History.",
    cancel: "You can cancel a pending SMS order from Order History. Credited amounts are returned to your wallet.",
  },
  smm: {
    howToOrder: "Go to Social Boosting, pick a service, enter the target link, choose quantity, and order from your wallet balance.",
    delivery: "SMM orders are processed by the supplier. Status updates from PENDING to PROCESSING to COMPLETED.",
  },
  wallet: {
    deposit: "Deposits are currently disabled while the payment flow is being finalised. Check back soon.",
    balance: "Your balance is shown in the sidebar and on the Deposit page. It is deducted on purchase and credited on refunds.",
    transactions: "All wallet movements are listed in Order History with date, type, amount, and status.",
  },
  auth: {
    login: "Sign in with the email and password you used to create your account.",
    signup: "Create an account at Sign Up. The first user created becomes the admin.",
    reset: "On the login page click 'Forgot your password?', enter your email, and follow the reset link sent to your inbox.",
  },
  support: {
    email: "support@investorplugx.com",
    responseTime: "1 business day",
    includeInfo:
      "Include your order reference (for example 'sms-order-...' or 'acct-...') so we can help faster.",
  },
}

export type CareContext = {
  userId?: string
  recentOrders?: Array<{ id: string; type: string; status: string; total: number }>
  walletBalance?: number
}

/**
 * Build the system prompt that scopes the assistant to the knowledge base.
 * The assistant can only answer from CARE_KB — it must say "I don't know"
 * rather than inventing details, and must escalate to human support for
 * anything outside its scope (fraud, legal, account compromise).
 */
export function buildCareSystemPrompt(ctx: CareContext): string {
  return `You are the InvestorLogs customer care assistant. You help customers solve problems on their own.

## Rules
- Answer ONLY from the knowledge base below. Never invent prices, policies, or features.
- If something is not in the knowledge base, say so plainly and tell the user to contact support.
- Be concise, warm, and actionable. Give the user the next step they can take right now.
- Escalate immediately to human support for: fraud, suspicious charges, account compromise, legal issues, or anything involving money you cannot verify.
- Never ask for or repeat passwords, API keys, or full credentials.
- If the user is angry, acknowledge the frustration first, then solve.

## Knowledge base
${JSON.stringify(CARE_KB, null, 2)}

## Customer context
- User ID: ${ctx.userId ?? "unknown"}
- Wallet balance: ${ctx.walletBalance ?? "unknown"}
- Recent orders: ${JSON.stringify(ctx.recentOrders ?? [])}

## Escalation contact
Email: ${CARE_KB.support.email} — response within ${CARE_KB.support.responseTime}.
Ask the user to include their order reference.`
}

/**
 * Classify whether the assistant can handle this message, or whether it must
 * be escalated to a human agent.
 */
export function needsEscalation(message: string): boolean {
  const lower = message.toLowerCase()
  const patterns = [
    "hack", "hacked", "compromised", "stolen", "fraud", "scam",
    "unauthorised", "unauthorized", "chargeback", "dispute",
    "legal", "lawsuit", "police", "court", "refund me now", "lawyer",
    "my account was", "someone else", "suspicious",
  ]
  return patterns.some((p) => lower.includes(p))
}

export function buildEscalationReply(): string {
  return (
    "I'm escalating this to our human support team right now. " +
    `They will contact you at ${CARE_KB.support.email} within ${CARE_KB.support.responseTime}. ` +
    `Please include your order reference so they can help you faster. ` +
    "For your own security, do not share passwords or API keys with anyone, including our support team."
  )
}