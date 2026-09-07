import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"

/**
 * Server-side session helpers for use in Server Components and Route Handlers.
 */

export async function getSession() {
  return await getServerSession(authOptions)
}

/**
 * Returns the current session or redirects unauthenticated visitors to the
 * login page. Use this in protected layouts/pages — the optimistic check in
 * `src/proxy.ts` only inspects cookie presence.
 */
export async function requireSession(callbackUrl = "/dashboard") {
  const session = await getSession()

  if (!session?.user) {
    redirect(`/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  return session
}