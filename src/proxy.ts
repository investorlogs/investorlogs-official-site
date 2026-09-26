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

const SESSION_COOKIE_SUBSTRINGS = [
  "next-auth.session-token", // http + https (__Secure- prefix included via substring)
  "next-auth.session_token", // just in case
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // NextAuth v4 uses `next-auth.session-token` on http and
  // `__Secure-next-auth.session-token` on https. Match by substring so both
  // (and any future __Host- prefix) are recognised. The previous list checked
  // for `next-auth.secure.session-token`, which never exists, so a successful
  // login on https was immediately bounced back to /auth/login — looking like
  // "Sign in does nothing".
  const hasSessionCookie = request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.value &&
        SESSION_COOKIE_SUBSTRINGS.some((part) => cookie.name.includes(part))
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