'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NotificationsBell } from './notifications-bell'

interface AppNavProps {
  locale: string
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

/**
 * Returns the first path segment after the locale (lowercased), e.g.
 * "/en/studio/abc" → "studio". The crumb renders as "/<segment>" next to
 * the brand lockup, so it always reflects the current route. Falls back
 * to "studio" at the locale root.
 */
function crumbFor(pathname: string, locale: string): string {
  const trimmed = pathname.replace(new RegExp(`^/${locale}`), '') || '/'
  const seg = trimmed.split('/').filter(Boolean)[0] ?? ''
  return (seg || 'studio').toLowerCase()
}

export function AppNav({ locale, user }: AppNavProps) {
  const pathname = usePathname()
  const initial = (user.name?.[0] ?? user.email?.[0] ?? 'U').toUpperCase()

  function isActive(segment: string) {
    return pathname.startsWith(`/${locale}/${segment}`)
  }

  const crumb = crumbFor(pathname, locale)

  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-md border-b"
      style={{
        background: 'oklch(0.235 0.003 256 / 0.85)',
        borderColor: 'var(--canvas-dark-300)',
        height: '56px',
      }}
    >
      <div className="max-w-[1280px] mx-auto px-8 h-full flex items-center justify-between relative">
        {/* LEFT — brand mark + crumb */}
        <Link href={`/${locale}/studio`} className="flex items-center gap-2.5 shrink-0 no-underline">
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg"
            style={{
              background: 'var(--brand-soft)',
              border: '1px solid oklch(0.85 0.18 90 / 0.30)',
              color: 'var(--brand)',
            }}
            aria-hidden="true"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 L20 6.5 L20 15.5 L12 20 L4 15.5 L4 6.5 Z" />
              <path d="M12 9 L16 11 L16 14.5 L12 16.5 L8 14.5 L8 11 Z" fill="currentColor" fillOpacity="0.55" stroke="none" />
            </svg>
          </span>
          <div className="flex items-baseline gap-2.5" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '-0.01em' }}>
            <span className="text-[15px]" style={{ color: 'var(--canvas-dark-ink-strong)' }}>Beehive Studio</span>
            <span
              className="hidden sm:inline-flex items-center lowercase"
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 500,
                fontSize: '11px',
                letterSpacing: '0.04em',
                color: 'var(--canvas-dark-ink-muted)',
              }}
            >
              <span style={{ color: 'var(--canvas-dark-300)' }}>/</span>
              {crumb}
            </span>
          </div>
        </Link>

        {/* CENTER — nav (absolutely positioned) */}
        <nav className="absolute left-1/2 -translate-x-1/2 flex gap-1">
          {[
            { label: 'Studio', href: `/${locale}/studio`, active: isActive('studio') },
            { label: 'Discover', href: `/${locale}/discover`, active: isActive('discover') },
            { label: 'Community', href: `/${locale}/community`, active: isActive('community') },
            // /hive is the existing public-hives route; fall back to /community for the Hive crumb
            { label: 'Hive', href: `/${locale}/hive`, active: isActive('hive') },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors no-underline"
              style={
                item.active
                  ? { color: 'var(--canvas-dark-ink-strong)', background: 'var(--canvas-dark-200)' }
                  : { color: 'var(--canvas-dark-ink-muted)' }
              }
              onMouseEnter={(e) => {
                if (!item.active) e.currentTarget.style.color = 'var(--canvas-dark-ink-strong)'
              }}
              onMouseLeave={(e) => {
                if (!item.active) e.currentTarget.style.color = 'var(--canvas-dark-ink-muted)'
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* RIGHT — notifications + avatar */}
        <div className="flex items-center gap-3.5">
          <NotificationsBell />
          <button
            className="w-[30px] h-[30px] rounded-full inline-flex items-center justify-center text-[12px] font-bold overflow-hidden"
            style={{
              background: 'var(--brand-soft)',
              border: '1px solid oklch(0.85 0.18 90 / 0.30)',
              color: 'var(--brand)',
              fontFamily: 'var(--font-display)',
            }}
            aria-label="Account menu"
          >
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              initial
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
