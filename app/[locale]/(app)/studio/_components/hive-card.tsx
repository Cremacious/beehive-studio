'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import type { UserHiveView } from '@/lib/actions/hive.actions'

type Props = {
  hive: UserHiveView
}

function formatRelative(d: Date | null): string {
  if (!d) return 'No activity yet'
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
    case 'MODERATOR':   return 'Moderator'
    case 'CONTRIBUTOR': return 'Contributor'
    case 'BETA_READER': return 'Beta Reader'
  }
}

export function HiveCard({ hive }: Props) {
  const { locale } = useParams<{ locale: string }>()
  const accent = roleAccent(hive.viewerRole)

  return (
    <Link
      href={`/${locale}/hive/${hive.id}`}
      className="group relative flex flex-col overflow-hidden transition-all no-underline"
      style={{
        background: 'var(--canvas-dark-100)',
        border: '1px solid var(--canvas-dark-300)',
        borderRadius: 'var(--r-2xl)',
        boxShadow: 'var(--el-1)',
        color: 'inherit',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = 'var(--el-3)'
        e.currentTarget.style.borderColor = 'oklch(0.40 0.003 256)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = 'var(--el-1)'
        e.currentTarget.style.borderColor = 'var(--canvas-dark-300)'
      }}
    >
      {/* Cover */}
      <div
        className="relative overflow-hidden"
        style={{ aspectRatio: '3 / 2', background: 'var(--canvas-dark-200)' }}
      >
        {hive.bookCoverUrl ? (
          <Image
            src={hive.bookCoverUrl}
            alt={hive.bookTitle ?? hive.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ color: 'oklch(from var(--brand) l c h / 0.4)', fontSize: '64px' }}
            aria-hidden="true"
          >
            ⬡
          </div>
        )}
      </div>

      {/* Body */}
      <div
        className="flex flex-col gap-1.5"
        style={{
          padding: '16px 18px 18px',
          borderTop: '1px solid var(--canvas-dark-300)',
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="truncate transition-colors group-hover:[color:var(--brand)]"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '16px',
              letterSpacing: '-0.01em',
              color: 'var(--canvas-dark-ink-strong)',
              lineHeight: 1.2,
              flex: 1,
              minWidth: 0,
            }}
          >
            {hive.name}
          </div>
          <span
            className="inline-flex items-center uppercase shrink-0"
            style={{
              padding: '3px 8px',
              borderRadius: 'var(--r-full)',
              background: `oklch(from ${accent} l c h / 0.20)`,
              border: `1px solid oklch(from ${accent} calc(l - 0.10) c h / 0.45)`,
              color: `oklch(from ${accent} calc(l - 0.30) c h)`,
              fontFamily: 'var(--font-display)',
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.06em',
            }}
          >
            {roleLabel(hive.viewerRole)}
          </span>
        </div>

        <div
          className="truncate"
          style={{
            fontSize: '12px',
            color: 'var(--canvas-dark-ink-muted)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          {hive.bookTitle ? (
            <>
              for <span style={{ color: 'var(--canvas-dark-ink)' }}>{hive.bookTitle}</span> ·{' '}
            </>
          ) : null}
          {hive.memberCount} {hive.memberCount === 1 ? 'member' : 'members'}
        </div>

        <div
          className="uppercase"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.10em',
            color: 'var(--canvas-dark-ink-muted)',
            marginTop: '4px',
          }}
        >
          {hive.lastActiveAt ? `Last active ${formatRelative(hive.lastActiveAt)}` : 'No activity yet'}
        </div>
      </div>
    </Link>
  )
}
