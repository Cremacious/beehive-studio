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

export function AppNav({ locale, user }: AppNavProps) {
  const pathname = usePathname()

  const initial = (user.name?.[0] ?? user.email?.[0] ?? 'U').toUpperCase()

  function isActive(segment: string) {
    return pathname.startsWith(`/${locale}/${segment}`)
  }

  const navItemBase =
    'relative px-3.5 py-1.5 rounded-full text-[14px] font-medium transition-colors'
  const navItemInactive = 'text-white/55 hover:text-white hover:bg-white/5'
  const navItemActive = 'text-brand bg-brand/10'

  return (
    <header className="sticky top-0 z-40 bg-[#141414]/90 backdrop-blur border-b border-border/70">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 h-14 flex items-center justify-between">

        {/* Left: logo + nav */}
        <div className="flex items-center gap-6">
          <Link href={`/${locale}`} className="flex items-center gap-2.5 shrink-0">
            <span className="relative inline-flex items-center justify-center w-8 h-8 rounded-[10px] bg-brand/15 border border-brand/30">
              <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="#FFC300" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 L20 6.5 L20 15.5 L12 20 L4 15.5 L4 6.5 Z"/>
                <path d="M12 9 L16 11 L16 14.5 L12 16.5 L8 14.5 L8 11 Z" fill="#FFC300" fillOpacity="0.6" stroke="none"/>
              </svg>
            </span>
            <span className="mainFont font-bold text-[15px] tracking-tight hidden sm:inline">Beehive</span>
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              href={`/${locale}/studio`}
              className={`${navItemBase} ${isActive('studio') ? navItemActive : navItemInactive}`}
            >
              <span className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
                Studio
              </span>
            </Link>
            <Link
              href={`/${locale}/community`}
              className={`${navItemBase} ${isActive('community') ? navItemActive : navItemInactive}`}
            >
              <span className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2 L20 6.5 L20 15.5 L12 20 L4 15.5 L4 6.5 Z"/>
                  <path d="M12 7 L16 9.5 L16 13.5 L12 16 L8 13.5 L8 9.5 Z"/>
                </svg>
                Community
              </span>
            </Link>
            <Link
              href={`/${locale}/discover`}
              className={`${navItemBase} ${isActive('discover') ? navItemActive : navItemInactive}`}
            >
              <span className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
                </svg>
                Discover
              </span>
            </Link>
          </nav>
        </div>

        {/* Right: bell + avatar */}
        <div className="flex items-center gap-1.5">
          <NotificationsBell />

          <button
            className="w-8 h-8 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center text-[12px] font-bold text-brand mainFont ml-1"
            aria-label="Account menu"
          >
            {user.image ? (
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
