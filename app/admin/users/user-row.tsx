'use client'

import { useState, useTransition } from 'react'
import {
  grantCompPremiumAction,
  revokeCompPremiumAction,
  setBannedAction,
  deleteUserAction,
} from './actions'

interface Row {
  id: string
  email: string
  name: string | null
  username: string | null
  createdAt: Date | string
  banned: boolean | null
  bannedReason: string | null
  subscriptionStatus: string | null
  compEntitlementUntil: Date | string | null
}

const PREMIUM_STATUSES = new Set(['active', 'trialing', 'past_due'])
const LIFETIME_SENTINEL_YEAR = 9000

function getTier(row: Row): { label: string; tone: 'free' | 'paid' | 'comp' | 'lifetime' } {
  if (row.compEntitlementUntil) {
    const d = new Date(row.compEntitlementUntil)
    if (d.getUTCFullYear() >= LIFETIME_SENTINEL_YEAR) return { label: 'Lifetime', tone: 'lifetime' }
    if (d.getTime() > Date.now()) {
      const days = Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      return { label: `Comp · ${days}d`, tone: 'comp' }
    }
  }
  if (row.subscriptionStatus && PREMIUM_STATUSES.has(row.subscriptionStatus))
    return { label: 'Premium', tone: 'paid' }
  return { label: 'Free', tone: 'free' }
}

export function UserRow({ row }: { row: Row }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const tier = getTier(row)

  const created = new Date(row.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const onGrant = (kind: 'DAYS_30' | 'DAYS_90' | 'DAYS_365' | 'LIFETIME') => {
    startTransition(async () => {
      await grantCompPremiumAction(row.id, kind)
      setOpen(false)
    })
  }
  const onRevoke = () => {
    startTransition(async () => {
      await revokeCompPremiumAction(row.id)
      setOpen(false)
    })
  }
  const onBan = () => {
    const reason = window.prompt('Reason for ban (optional):') ?? undefined
    startTransition(async () => {
      await setBannedAction(row.id, true, reason)
      setOpen(false)
    })
  }
  const onUnban = () => {
    startTransition(async () => {
      await setBannedAction(row.id, false)
      setOpen(false)
    })
  }
  const onDelete = () => {
    if (!window.confirm(`Permanently delete user ${row.email}? This cascades and cannot be undone.`))
      return
    startTransition(async () => {
      await deleteUserAction(row.id)
      setOpen(false)
    })
  }

  return (
    <li
      className="grid px-5 py-3 text-sm items-center"
      style={{
        gridTemplateColumns: '1.4fr 0.9fr 0.8fr 0.9fr 1fr',
        color: 'var(--canvas-dark-ink)',
      }}
    >
      <div className="min-w-0">
        <div className="truncate" style={{ color: 'var(--canvas-dark-ink-strong)' }}>
          {row.username ? `@${row.username}` : row.name ?? '–'}
        </div>
        <div className="truncate text-[11px]" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          {row.email}
        </div>
      </div>
      <span style={{ color: 'var(--canvas-dark-ink-muted)' }}>{created}</span>
      <span style={{ color: tier.tone === 'free' ? 'var(--canvas-dark-ink-muted)' : 'var(--brand)' }}>
        {tier.label}
      </span>
      <span style={{ color: row.banned ? 'oklch(0.7 0.2 25)' : 'var(--canvas-dark-ink-muted)' }}>
        {row.banned ? `Banned${row.bannedReason ? ` · ${row.bannedReason}` : ''}` : 'Active'}
      </span>
      <div className="text-right relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={pending}
          className="px-3 py-1 text-xs rounded-[var(--r-pill)]"
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            boxShadow: 'var(--sh-tile)',
            color: 'var(--canvas-dark-ink-strong)',
          }}
        >
          {pending ? 'Working…' : 'Manage ▾'}
        </button>
        {open && (
          <div
            className="absolute right-0 top-full mt-2 z-10 w-56 p-2 rounded-[var(--r-card)] text-left"
            style={{
              background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
              boxShadow: 'var(--sh-card)',
              borderTop: 'var(--br-card)',
            }}
          >
            <MenuLabel>Grant premium</MenuLabel>
            <MenuButton onClick={() => onGrant('DAYS_30')}>30 days</MenuButton>
            <MenuButton onClick={() => onGrant('DAYS_90')}>90 days</MenuButton>
            <MenuButton onClick={() => onGrant('DAYS_365')}>1 year</MenuButton>
            <MenuButton onClick={() => onGrant('LIFETIME')}>Lifetime</MenuButton>
            <hr className="my-1.5" style={{ borderColor: 'var(--canvas-dark-300)' }} />
            {row.compEntitlementUntil && (
              <MenuButton onClick={onRevoke}>Revoke comp premium</MenuButton>
            )}
            {row.banned ? (
              <MenuButton onClick={onUnban}>Unban</MenuButton>
            ) : (
              <MenuButton onClick={onBan}>Ban user…</MenuButton>
            )}
            <MenuButton onClick={onDelete} destructive>
              Delete user…
            </MenuButton>
          </div>
        )}
      </div>
    </li>
  )
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-2 pt-1 pb-0.5 text-[10px] font-mono uppercase tracking-[0.14em]"
      style={{ color: 'var(--canvas-dark-ink-muted)' }}
    >
      {children}
    </div>
  )
}

function MenuButton({
  children,
  onClick,
  destructive,
}: {
  children: React.ReactNode
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-2 py-1.5 text-sm rounded-[var(--r-row)] hover:brightness-110"
      style={{
        color: destructive ? 'oklch(0.72 0.2 25)' : 'var(--canvas-dark-ink)',
      }}
    >
      {children}
    </button>
  )
}
