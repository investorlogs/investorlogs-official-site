import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Optimistic auth gate (Next.js 16 "proxy" convention, formerly middleware).
 *
 * This only checks for the presence of the NextAuth session cookie — it does
 * NOT validate the JWT. Real authorization is enforced server-side in
 * `src/app/dashboard/layout.tsx` via `requireSession()`.
 *
 * Do not import `@/lib/auth` here: it pulls in Prisma and bcrypt, which are
 * not available in the proxy runtime.
 */

const SESSION_COOKIES = [
  "next-auth.session-token", // http
  "next-auth.secure.session-token", // https
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const hasSessionCookie = SESSION_COOKIES.some(
    (name) => request.cookies.get(name)?.value
  )

  const isAuthPage =
    pathname.startsWith("/auth/login") || pathname.startsWith("/auth/signup")
  const isDashboard = pathname.startsWith("/dashboard")

  // Unauthenticated users are redirected to the login page
  if (isDashboard && !hasSessionCookie) {
    const loginUrl = new URL("/auth/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Authenticated users skip the login/signup pages
  if (isAuthPage && hasSessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/login", "/auth/signup"],
}