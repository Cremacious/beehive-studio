import { NextResponse, type NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { defaultLocale, locales } from './i18n/config'

const BLOCKED_UA = /sqlmap|nikto|nmap|masscan|zgrab|python-requests\/2\.[0-1]/i

const PUBLIC_PATHS = new Set([
  '/',
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/privacy',
  '/terms',
  '/cookies',
  '/dmca',
])

function isPublicPath(pathname: string): boolean {
  const stripped = pathname.replace(/^\/(en)(\/|$)/, '/')
  return PUBLIC_PATHS.has(stripped) ||
    stripped.startsWith('/books/') ||
    stripped.startsWith('/u/')
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

  try {
    const sessionRes = await fetch(
      `${process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'}/api/auth/get-session`,
      { headers: { cookie: request.headers.get('cookie') ?? '' } },
    )
    const session = await sessionRes.json()

    if (!session?.user) {
      const signInUrl = new URL(`/${defaultLocale}/sign-in`, request.url)
      return NextResponse.redirect(signInUrl)
    }

    const strippedPath = pathname.replace(/^\/(en)(\/|$)/, '/')
    const isOnboardingPath = strippedPath === '/onboarding'

    if (!session.user.onboardingComplete && !isOnboardingPath) {
      return NextResponse.redirect(new URL(`/${defaultLocale}/onboarding`, request.url))
    }

    if (session.user.onboardingComplete && isOnboardingPath) {
      return NextResponse.redirect(new URL(`/${defaultLocale}/studio`, request.url))
    }
  } catch {
    // Session fetch failed — let the page handle it
  }

  return intlResponse ?? NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
