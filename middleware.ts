import { NextResponse, type NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { defaultLocale, locales } from './i18n/config'
import { ADMIN_COOKIE_NAME, verifySessionCookie } from './lib/admin/session'

const localePattern = new RegExp(`^/(${locales.join('|')})(\/|$)`)

const BLOCKED_UA = /sqlmap|nikto|nmap|masscan|zgrab|python-requests\/2\.[0-1]/i

const PUBLIC_PATHS = new Set([
  '/',
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/pricing',
  '/privacy',
  '/terms',
  '/cookies',
  '/dmca',
])

function isPublicPath(pathname: string): boolean {
  const stripped = pathname.replace(localePattern, '/')
  return PUBLIC_PATHS.has(stripped) ||
    stripped.startsWith('/books/') ||
    stripped.startsWith('/u/') ||
    stripped.startsWith('/discover')
}

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ua = request.headers.get('user-agent') ?? ''

  if (BLOCKED_UA.test(ua)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // /admin is locale-free and gated by a separate session cookie.
  if (pathname.startsWith('/admin')) {
    // /admin/login is the only unauthenticated admin path.
    if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) {
      return NextResponse.next()
    }
    const adminCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const session = await verifySessionCookie(adminCookie)
    if (!session) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    return NextResponse.next()
  }

  const intlResponse = intlMiddleware(request)

  if (isPublicPath(pathname)) return intlResponse

  const sessionToken =
    request.cookies.get('better-auth.session_token')?.value ??
    request.cookies.get('__Secure-better-auth.session_token')?.value

  if (!sessionToken) {
    const signInUrl = new URL(`/${defaultLocale}/sign-in`, request.url)
    signInUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(signInUrl)
  }

  // Optimistic gate only: a session token cookie exists, so let the request
  // through. We deliberately do NOT validate the session here. Server
  // components call auth.api.getSession() and redirect stale/forged sessions to
  // sign-in, so validity is enforced where it can read cookies reliably.
  //
  // The previous fetch to ${BETTER_AUTH_URL}/api/auth/get-session caused an
  // infinite redirect loop on the Vercel (apex/www) deploy: that cross-origin
  // request returned null (the __Secure- session cookie wasn't carried across
  // the host redirect) while in-process getSession returned the real user, so
  // middleware bounced to /sign-in and the page bounced back to /studio forever.
  return intlResponse ?? NextResponse.next()
}

export const config = {
  // Exclude API, Next internals, and any path containing a dot. The dot rule
  // exempts static assets AND the SEO/PWA metadata endpoints (robots.txt,
  // sitemap.xml, manifest.webmanifest, og-default.png, icon-*.png) from the
  // auth gate so crawlers can fetch them. Real page routes never contain a dot
  // (usernames are [a-zA-Z0-9_]+, book ids are cuid).
  matcher: ['/((?!api|_next/static|_next/image|.*\\..*).*)'],
}
