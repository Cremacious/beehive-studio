'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, User as UserIcon, CreditCard, Users } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authClient } from '@/lib/auth-client'
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
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const initial = (user.name?.[0] ?? user.email?.[0] ?? 'U').toUpperCase()

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    try {
      await authClient.signOut()
      router.replace(`/${locale}/sign-in`)
      router.refresh()
    } catch {
      setSigningOut(false)
    }
  }

  function isActive(segment: string) {
    return pathname.startsWith(`/${locale}/${segment}`)
  }

  return (
    <header
      className="sticky top-1.5 z-40 mx-4 mt-1.5 backdrop-blur-md"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-nav)',
        boxShadow: 'var(--sh-card)',
        border: 'var(--br-card)',
        height: '56px',
      }}
    >
      <div className="max-w-[1280px] mx-auto px-6 h-full flex items-center justify-between relative">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-[30px] h-[30px] inline-flex items-center justify-center text-[12px] font-bold overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas-dark-50)]"
                style={{
                  background: 'var(--brand-soft)',
                  border: '1px solid oklch(0.85 0.18 90 / 0.30)',
                  color: 'var(--brand)',
                  fontFamily: 'var(--font-display)',
                  borderRadius: 'var(--r-pill)',
                  boxShadow: 'var(--sh-tile)',
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
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-60 border-[var(--canvas-dark-300)] bg-[var(--canvas-dark-100)] text-[var(--canvas-dark-ink)]"
            >
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span
                    className="text-[13px] font-semibold truncate"
                    style={{ color: 'var(--canvas-dark-ink-strong)', fontFamily: 'var(--font-display)' }}
                  >
                    {user.name ?? 'Your account'}
                  </span>
                  {user.email && (
                    <span
                      className="text-[11px] truncate"
                      style={{ color: 'var(--canvas-dark-ink-muted)' }}
                    >
                      {user.email}
                    </span>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator style={{ background: 'var(--canvas-dark-300)' }} />
              <DropdownMenuItem asChild>
                <Link href={`/${locale}/studio`} className="cursor-pointer no-underline">
                  <UserIcon size={14} /> Your studio
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/${locale}/friends`} className="cursor-pointer no-underline">
                  <Users size={14} /> Friends
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/${locale}/settings/billing`} className="cursor-pointer no-underline">
                  <CreditCard size={14} /> Billing
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator style={{ background: 'var(--canvas-dark-300)' }} />
              <DropdownMenuItem
                onSelect={(e) => { e.preventDefault(); handleSignOut() }}
                disabled={signingOut}
                variant="destructive"
                className="cursor-pointer"
              >
                <LogOut size={14} /> {signingOut ? 'Signing out…' : 'Sign out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
