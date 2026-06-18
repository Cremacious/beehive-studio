'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NotificationsBell } from './notifications-bell'
import { UserMenuDropdown } from '@/components/nav/user-menu-dropdown'

interface AppNavProps {
  locale: string
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
  username: string | null
}

export function AppNav({ locale, user, username }: AppNavProps) {
  const pathname = usePathname()

  function isActive(segment: string) {
    return pathname.startsWith(`/${locale}/${segment}`)
  }

  const studioActive = isActive('studio') || isActive('hive') || isActive('hives')
  const communityActive =
    isActive('community') ||
    isActive('friends') ||
    isActive('sparks') ||
    isActive('reading-lists') ||
    isActive('clubs')
  const profileActive = username ? pathname === `/${locale}/u/${username}` : false

  const navItems = [
    { label: 'Studio', href: `/${locale}/studio`, active: studioActive },
    { label: 'Community', href: `/${locale}/community`, active: communityActive },
    { label: 'Discover', href: `/${locale}/discover`, active: isActive('discover') },
    ...(username
      ? [{ label: 'Profile', href: `/${locale}/u/${username}`, active: profileActive }]
      : []),
  ]

  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-md"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
        borderBottom: 'var(--br-card)',
        height: '56px',
      }}
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-3 relative">
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
            <span className="text-[15px] hidden sm:inline" style={{ color: 'var(--canvas-dark-ink-strong)' }}>Beehive Studio</span>
          </div>
        </Link>

        {/* CENTER — nav (absolutely positioned on desktop, inline-flex on mobile) */}
        <nav className="sm:absolute sm:left-1/2 sm:-translate-x-1/2 flex gap-1">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="px-2.5 sm:px-3.5 py-1.5 rounded-full text-[12px] sm:text-[13px] font-medium transition-colors no-underline whitespace-nowrap"
              style={
                item.active
                  ? { color: 'var(--brand)' }
                  : { color: 'var(--canvas-dark-ink)' }
              }
              onMouseEnter={(e) => {
                if (!item.active) e.currentTarget.style.color = 'var(--canvas-dark-ink-strong)'
              }}
              onMouseLeave={(e) => {
                if (!item.active) e.currentTarget.style.color = 'var(--canvas-dark-ink)'
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* RIGHT — notifications + avatar */}
        <div className="flex items-center gap-3.5">
          <NotificationsBell />
          <UserMenuDropdown
            locale={locale}
            username={username}
            name={user.name ?? null}
            image={user.image ?? null}
            email={user.email ?? null}
          />
        </div>
      </div>
    </header>
  )
}
