'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Users } from 'lucide-react'
import type { UserHiveView } from '@/lib/actions/hive.actions'

type Props = { hive: UserHiveView }

function relTime(d: Date | null): string {
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

const ROLE_LABEL: Record<UserHiveView['viewerRole'], string> = {
  OWNER: 'Owner',
  MODERATOR: 'Moderator',
  CONTRIBUTOR: 'Contributor',
  BETA_READER: 'Reader',
}

const ROLE_TONE: Record<UserHiveView['viewerRole'], string> = {
  OWNER: 'var(--status-final)',
  MODERATOR: 'var(--status-revised)',
  CONTRIBUTOR: 'var(--status-first-draft)',
  BETA_READER: 'var(--canvas-dark-400)',
}

/**
 * Compact hive tile for the /hives index grid.
 * No cover image — uses a brand-yellow honeycomb hex glyph as the visual
 * anchor. Same .bcv / iOS-card chrome aesthetic as the BookCard family.
 */
export function HiveIndexCard({ hive }: Props) {
  const { locale } = useParams<{ locale: string }>()
  const roleTone = ROLE_TONE[hive.viewerRole]
  const roleLabel = ROLE_LABEL[hive.viewerRole]

  return (
    <Link
      href={`/${locale}/hive/${hive.id}`}
      className="hic"
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div className="hic-head">
        <span className="hic-glyph" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
            <path d="M12 2 L20 6.5 L20 15.5 L12 20 L4 15.5 L4 6.5 Z" />
            <path d="M12 9 L16 11 L16 14.5 L12 16.5 L8 14.5 L8 11 Z" fill="currentColor" fillOpacity="0.55" stroke="none" />
          </svg>
        </span>
        <span
          className="hic-role"
          style={{
            color: roleTone,
            background: `oklch(from ${roleTone} l c h / 0.16)`,
          }}
        >
          {roleLabel}
        </span>
      </div>

      <div className="hic-body">
        <p className="hic-name">{hive.name}</p>
        {hive.bookTitle ? (
          <p className="hic-sub">
            <em>{hive.bookTitle}</em>
          </p>
        ) : (
          <p className="hic-sub hic-sub-empty">Standalone hive</p>
        )}
      </div>

      <div className="hic-foot">
        <span className="hic-meta">
          <Users size={11} />
          {hive.memberCount} {hive.memberCount === 1 ? 'member' : 'members'}
        </span>
        <span className="hic-meta">{relTime(hive.lastActiveAt)}</span>
      </div>
    </Link>
  )
}
