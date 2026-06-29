'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HelpCircle, PenLine, Users, Compass, Menu, UserCircle, Settings, X } from 'lucide-react'
import { NotificationsBell } from './notifications-bell'
import { UserMenuDropdown } from '@/components/nav/user-menu-dropdown'
import { CommunityNavDropdown } from '@/components/nav/community-nav-dropdown'
import { BeehiveMark } from '@/components/brand/beehive-mark'

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
  // Mobile-only "More" bottom sheet (issue #50). Desktop never renders it.
  const [moreOpen, setMoreOpen] = useState(false)

  // Close the sheet on route change so it doesn't linger after navigating.
  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

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
  const settingsActive = isActive('settings')
  const supportActive = isActive('support')
  const moreActive = profileActive || settingsActive || supportActive

  const navItems = [
    { label: 'Studio', href: `/${locale}/studio`, active: studioActive },
    { label: 'Community', href: `/${locale}/community`, active: communityActive },
    { label: 'Discover', href: `/${locale}/discover`, active: isActive('discover') },
    ...(username
      ? [{ label: 'Profile', href: `/${locale}/u/${username}`, active: profileActive }]
      : []),
    { label: 'Settings', href: `/${locale}/settings/account`, active: isActive('settings') },
  ]

  return (
    <>
    <header
      className="sticky top-0 z-40 backdrop-blur-md pt-safe"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
        borderBottom: 'var(--br-card)',
      }}
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-[56px] flex items-center justify-between gap-3 relative">
        {/* LEFT — brand mark + crumb */}
        <Link href={`/${locale}/studio`} aria-label="Beehive Books" className="flex items-center gap-2 shrink-0 no-underline">
          <BeehiveMark className="h-6 w-auto" />
          <span
            className="text-[15px]"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--canvas-dark-ink-strong)' }}
          >
            Beehive Books
          </span>
        </Link>

        {/* CENTER — desktop nav. Hidden on mobile (replaced by bottom bar). */}
        <nav className="max-md:hidden sm:absolute sm:left-1/2 sm:-translate-x-1/2 flex gap-1">
          {navItems.map((item) => {
            if (item.label === 'Community') {
              return (
                <CommunityNavDropdown
                  key="Community"
                  locale={locale}
                  active={item.active}
                />
              )
            }
            return (
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
            )
          })}
        </nav>

        {/* RIGHT — support + notifications + avatar */}
        <div className="flex items-center gap-3.5">
          <Link
            href={`/${locale}/support`}
            aria-label="Support"
            className="max-md:hidden inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--canvas-dark-ink)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--canvas-dark-ink-muted)' }}
          >
            <HelpCircle size={18} />
          </Link>
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

    {/* ── Mobile bottom tab bar (issue #50, variant C) ──────────────────
        Fixed thumb-reachable nav for the three core destinations + a More
        sheet. Hidden at md+ so desktop is untouched. */}
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 flex pb-safe backdrop-blur-md"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
        borderTop: 'var(--br-card)',
      }}
    >
      <BottomTab href={`/${locale}/studio`} label="Studio" active={studioActive} icon={<PenLine size={20} />} />
      <BottomTab href={`/${locale}/community`} label="Community" active={communityActive} icon={<Users size={20} />} />
      <BottomTab href={`/${locale}/discover`} label="Discover" active={isActive('discover')} icon={<Compass size={20} />} />
      <button
        type="button"
        onClick={() => setMoreOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={moreOpen}
        className="flex-1 min-h-[56px] flex flex-col items-center justify-center gap-1 cursor-pointer"
        style={{ color: moreActive ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)' }}
      >
        <Menu size={20} />
        <span className="text-[10px] font-medium" style={{ fontFamily: 'var(--font-display)' }}>More</span>
      </button>
    </nav>

    {/* More sheet — Profile / Settings / Support (mobile only). */}
    {moreOpen && (
      <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="More menu">
        <button
          type="button"
          aria-label="Close menu"
          className="absolute inset-0 cursor-default"
          style={{ background: 'oklch(0 0 0 / 0.5)' }}
          onClick={() => setMoreOpen(false)}
        />
        <div
          className="absolute bottom-0 inset-x-0 pb-safe px-3 pt-3"
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            borderTop: 'var(--br-card)',
            borderTopLeftRadius: 'var(--r-card)',
            borderTopRightRadius: 'var(--r-card)',
            boxShadow: 'var(--sh-card)',
          }}
        >
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="text-[13px] font-bold" style={{ color: 'var(--brand)', fontFamily: 'var(--font-display)' }}>More</span>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              aria-label="Close"
              className="inline-flex items-center justify-center w-9 h-9 rounded-full"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex flex-col pb-2">
            {username && (
              <MoreLink href={`/${locale}/u/${username}`} label="Profile" icon={<UserCircle size={18} />} />
            )}
            <MoreLink href={`/${locale}/settings/account`} label="Settings" icon={<Settings size={18} />} />
            <MoreLink href={`/${locale}/support`} label="Support" icon={<HelpCircle size={18} />} />
          </div>
        </div>
      </div>
    )}
    </>
  )
}

// ── Mobile nav primitives (issue #50) ──────────────────────────────────
function BottomTab({
  href,
  label,
  active,
  icon,
}: {
  href: string
  label: string
  active: boolean
  icon: ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex-1 min-h-[56px] flex flex-col items-center justify-center gap-1 no-underline"
      style={{ color: active ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)' }}
    >
      {icon}
      <span className="text-[10px] font-medium" style={{ fontFamily: 'var(--font-display)' }}>{label}</span>
    </Link>
  )
}

function MoreLink({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 min-h-[48px] px-3 rounded-[var(--r-row)] no-underline"
      style={{ color: 'var(--canvas-dark-ink)' }}
    >
      <span style={{ color: 'var(--canvas-dark-ink-muted)' }}>{icon}</span>
      <span className="text-[14px]" style={{ fontFamily: 'var(--font-display)' }}>{label}</span>
    </Link>
  )
}
