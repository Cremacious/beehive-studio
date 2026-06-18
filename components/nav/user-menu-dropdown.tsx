'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  LogOut,
  User as UserIcon,
  Users,
  Bell,
  Shield,
  Sliders,
  CreditCard,
  UserCircle,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'
import { authClient } from '@/lib/auth-client'

interface UserMenuDropdownProps {
  locale: string
  username: string | null
  name: string | null
  image: string | null
  email: string | null
}

export function UserMenuDropdown({
  locale,
  username,
  name,
  image,
  email,
}: UserMenuDropdownProps) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const initial = (name?.[0] ?? email?.[0] ?? 'U').toUpperCase()

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

  return (
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
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            initial
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-64"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          border: '1px solid oklch(1 0 0 / 0.06)',
          boxShadow: 'var(--sh-card)',
        }}
      >
        {/* Identity row */}
        <DropdownMenuLabel className="font-normal px-3 py-3">
          <div className="flex items-center gap-3">
            <span
              className="w-10 h-10 flex-shrink-0 inline-flex items-center justify-center text-[15px] font-bold overflow-hidden"
              style={{
                background: 'var(--brand-soft)',
                border: '1px solid oklch(0.85 0.18 90 / 0.30)',
                color: 'var(--brand)',
                fontFamily: 'var(--font-display)',
                borderRadius: 'var(--r-pill)',
              }}
            >
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                initial
              )}
            </span>
            <div className="flex-1 min-w-0">
              <div
                className="text-[13px] font-semibold truncate"
                style={{ color: 'var(--canvas-dark-ink-strong)', fontFamily: 'var(--font-display)' }}
              >
                {name ?? 'Your account'}
              </div>
              {username && (
                <div
                  className="text-[11px] truncate"
                  style={{ color: 'var(--brand)', fontFamily: 'var(--font-mono)' }}
                >
                  @{username}
                </div>
              )}
              {email && (
                <div
                  className="text-[11px] truncate"
                  style={{ color: 'var(--canvas-dark-ink-muted)' }}
                >
                  {email}
                </div>
              )}
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator style={{ background: 'oklch(1 0 0 / 0.06)' }} />

        {/* Profile + Friends */}
        <DropdownMenuGroup>
          {username ? (
            <DropdownMenuItem asChild>
              <Link href={`/${locale}/u/${username}`} className="cursor-pointer no-underline gap-2.5">
                <UserCircle size={14} style={{ color: 'var(--canvas-dark-ink-muted)' }} />
                My Profile
              </Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled className="cursor-default gap-2.5">
              <UserCircle size={14} style={{ color: 'var(--canvas-dark-ink-muted)' }} />
              <span>My Profile</span>
              <span
                className="ml-auto text-[10px] tracking-wide uppercase"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                set username first
              </span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link href={`/${locale}/community/friends`} className="cursor-pointer no-underline gap-2.5">
              <Users size={14} style={{ color: 'var(--canvas-dark-ink-muted)' }} />
              Friends
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator style={{ background: 'oklch(1 0 0 / 0.06)' }} />

        {/* Settings links */}
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href={`/${locale}/settings/account`} className="cursor-pointer no-underline gap-2.5">
              <UserIcon size={14} style={{ color: 'var(--canvas-dark-ink-muted)' }} />
              Account
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/${locale}/settings/notifications`} className="cursor-pointer no-underline gap-2.5">
              <Bell size={14} style={{ color: 'var(--canvas-dark-ink-muted)' }} />
              Notifications
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/${locale}/settings/privacy`} className="cursor-pointer no-underline gap-2.5">
              <Shield size={14} style={{ color: 'var(--canvas-dark-ink-muted)' }} />
              Privacy
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/${locale}/settings/preferences`} className="cursor-pointer no-underline gap-2.5">
              <Sliders size={14} style={{ color: 'var(--canvas-dark-ink-muted)' }} />
              Preferences
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/${locale}/settings/billing`} className="cursor-pointer no-underline gap-2.5">
              <CreditCard size={14} style={{ color: 'var(--canvas-dark-ink-muted)' }} />
              Billing
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator style={{ background: 'oklch(1 0 0 / 0.06)' }} />

        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            handleSignOut()
          }}
          disabled={signingOut}
          variant="destructive"
          className="cursor-pointer gap-2.5"
        >
          <LogOut size={14} />
          {signingOut ? 'Signing out...' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
