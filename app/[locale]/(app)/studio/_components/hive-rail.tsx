'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Hexagon, Plus } from 'lucide-react'
import type { UserHiveView } from '@/lib/actions/hive.actions'
import { CreateHiveModal } from './create-hive-modal'

type Props = {
  hives: UserHiveView[]
  locale: string
}

const MAX_VISIBLE = 8

function formatRelative(d: Date | null): string {
  if (!d) return 'no activity'
  const diff = Date.now() - new Date(d).getTime()
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function roleAccent(role: UserHiveView['viewerRole']): string {
  switch (role) {
    case 'OWNER':       return 'var(--status-final)'
    case 'MODERATOR':   return 'var(--status-revised)'
    case 'CONTRIBUTOR': return 'var(--status-first-draft)'
    case 'BETA_READER': return 'var(--canvas-dark-300)'
  }
}

function roleLabel(role: UserHiveView['viewerRole']): string {
  switch (role) {
    case 'OWNER':       return 'Owner'
    case 'MODERATOR':   return 'Mod'
    case 'CONTRIBUTOR': return 'Contrib'
    case 'BETA_READER': return 'Reader'
  }
}

const PANEL_STYLE = {
  padding: '18px',
  borderRadius: 'var(--r-card)',
  background:
    'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
  border: 'var(--br-card)',
  boxShadow: 'var(--sh-card)',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '12px',
} as const

export function HiveRail({ hives, locale }: Props) {
  const [createOpen, setCreateOpen] = useState(false)

  const visible = hives.slice(0, MAX_VISIBLE)
  const hidden = Math.max(0, hives.length - visible.length)

  return (
    <aside style={PANEL_STYLE} aria-label="Your hives">
      <h2
        className="font-comfortaa font-bold m-0"
        style={{
          color: 'var(--brand)',
          fontSize: '14px',
          letterSpacing: '-0.01em',
        }}
      >
        Your hives
      </h2>

      {hives.length === 0 ? (
        <div
          className="text-center"
          style={{
            padding: '20px 12px',
            borderRadius: 'var(--r-row)',
            border: '1px dashed var(--canvas-dark-300)',
            background: 'transparent',
            color: 'var(--canvas-dark-ink-muted)',
            fontFamily: 'var(--font-ui)',
            fontSize: '12px',
            lineHeight: 1.4,
          }}
        >
          No hives yet — start one to collaborate.
        </div>
      ) : (
        <ul
          className="flex flex-col list-none m-0 p-0"
          style={{ gap: '8px' }}
        >
          {visible.map((hive) => {
            const accent = roleAccent(hive.viewerRole)
            return (
              <li key={hive.id} className="m-0 p-0">
                <Link
                  href={`/${locale}/hive/${hive.id}`}
                  className="flex items-center no-underline transition-all hive-rail-row"
                  style={{
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: 'var(--r-row)',
                    background:
                      'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                    border: 'var(--br-card)',
                    boxShadow: 'var(--sh-tile)',
                    color: 'inherit',
                  }}
                >
                  <span
                    className="inline-flex items-center justify-center shrink-0"
                    aria-hidden="true"
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: 'var(--r-pill)',
                      background:
                        'linear-gradient(180deg, var(--canvas-dark-300), var(--canvas-dark-250))',
                      color: 'var(--brand)',
                      boxShadow: 'var(--sh-tile)',
                    }}
                  >
                    <Hexagon size={13} strokeWidth={2.2} />
                  </span>

                  <span
                    className="flex flex-col min-w-0 flex-1"
                    style={{ gap: '2px' }}
                  >
                    <span
                      className="truncate"
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: '13px',
                        letterSpacing: '-0.005em',
                        color: 'var(--canvas-dark-ink-strong)',
                        lineHeight: 1.2,
                      }}
                    >
                      {hive.name}
                    </span>
                    <span
                      className="truncate"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        letterSpacing: '0.04em',
                        color: 'var(--canvas-dark-ink-muted)',
                        lineHeight: 1.2,
                      }}
                    >
                      {hive.memberCount}{' '}
                      {hive.memberCount === 1 ? 'member' : 'members'} ·{' '}
                      {formatRelative(hive.lastActiveAt)}
                    </span>
                  </span>

                  <span
                    className="inline-flex items-center uppercase shrink-0"
                    style={{
                      padding: '2px 6px',
                      borderRadius: 'var(--r-full)',
                      background: `oklch(from ${accent} l c h / 0.20)`,
                      border: `1px solid oklch(from ${accent} calc(l - 0.10) c h / 0.45)`,
                      color: `oklch(from ${accent} calc(l - 0.30) c h)`,
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                    }}
                  >
                    {roleLabel(hive.viewerRole)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {hidden > 0 && (
        <div
          className="text-center"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: 'var(--canvas-dark-ink-muted)',
            paddingTop: '2px',
          }}
        >
          + {hidden} more in your library
        </div>
      )}

      {/* Always-visible + New hive tile */}
      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        style={{
          padding: '11px 12px',
          borderRadius: 'var(--r-row)',
          background: 'transparent',
          border: '1px dashed var(--canvas-dark-300)',
          color: 'var(--canvas-dark-ink-muted)',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: '12px',
          letterSpacing: '0.02em',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--canvas-dark-ink-strong)'
          e.currentTarget.style.borderColor = 'var(--brand)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--canvas-dark-ink-muted)'
          e.currentTarget.style.borderColor = 'var(--canvas-dark-300)'
        }}
      >
        <Plus size={14} strokeWidth={2.5} />
        New hive
      </button>

      <style>{`
        .hive-rail-row:hover {
          transform: translateY(-1px);
        }
      `}</style>

      <CreateHiveModal open={createOpen} onOpenChange={setCreateOpen} />
    </aside>
  )
}
