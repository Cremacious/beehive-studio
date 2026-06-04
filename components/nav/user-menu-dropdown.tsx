'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, User as UserIcon, Users, Settings as SettingsIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
        className="w-60 border-[var(--canvas-dark-300)] bg-[var(--canvas-dark-100)] text-[var(--canvas-dark-ink)]"
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span
              className="text-[13px] font-semibold truncate"
              style={{
                color: 'var(--canvas-dark-ink-strong)',
                fontFamily: 'var(--font-display)',
              }}
            >
              {name ?? 'Your account'}
            </span>
            {email && (
              <span
                className="text-[11px] truncate"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                {email}
              </span>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator style={{ background: 'var(--canvas-dark-300)' }} />
        {username && (
          <DropdownMenuItem asChild>
            <Link href={`/${locale}/u/${username}`} className="cursor-pointer no-underline">
              <UserIcon size={14} /> View profile
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/friends`} className="cursor-pointer no-underline">
            <Users size={14} /> Friends
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/settings`} className="cursor-pointer no-underline">
            <SettingsIcon size={14} /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator style={{ background: 'var(--canvas-dark-300)' }} />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            handleSignOut()
          }}
          disabled={signingOut}
          variant="destructive"
          className="cursor-pointer"
        >
          <LogOut size={14} /> {signingOut ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
