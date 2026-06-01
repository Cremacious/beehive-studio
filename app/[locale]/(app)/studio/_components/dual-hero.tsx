'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { BookSummary } from '@/lib/actions/book.actions'
import type { UserHiveView } from '@/lib/actions/hive.actions'
import { CreateHiveModal } from './create-hive-modal'

type Props = {
  book: BookSummary | null
  hive: UserHiveView | null
  locale: string
}

function formatRelative(d: Date | null): string {
  if (!d) return 'no activity yet'
  const diff = Date.now() - new Date(d).getTime()
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return 'just now'
  if (hours === 1) return '1 hour ago'
  if (hours < 24) return `${hours} hours ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

const PANEL_BG_BOOK =
  'radial-gradient(ellipse at top left, oklch(from var(--brand) l c h / 0.18), transparent 60%), linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))'

const PANEL_BG_HIVE =
  'radial-gradient(ellipse at top right, oklch(0.48 0.06 165 / 0.22), transparent 60%), linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))'

const TILE_BASE_STYLE = {
  borderRadius: 'var(--r-card)',
  border: 'var(--br-card)',
  boxShadow: 'var(--sh-card)',
  color: 'var(--canvas-dark-ink)',
  fontFamily: 'var(--font-ui)',
  padding: '28px 30px 26px',
  display: 'flex',
  flexDirection: 'column' as const,
  minHeight: '220px',
} as const

const EYEBROW_STYLE = {
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
  letterSpacing: '0.16em',
  color: 'var(--canvas-dark-ink-muted)',
  textTransform: 'uppercase' as const,
  marginBottom: '12px',
} as const

const TITLE_STYLE = {
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: '22px',
  letterSpacing: '-0.01em',
  lineHeight: 1.15,
  color: 'var(--brand)',
  margin: 0,
  marginBottom: '8px',
  textWrap: 'balance' as const,
} as const

const SUBLINE_STYLE = {
  fontFamily: 'var(--font-mono)',
  fontSize: '12px',
  letterSpacing: '0.04em',
  color: 'var(--canvas-dark-ink-muted)',
  margin: 0,
} as const

const PRIMARY_CTA_STYLE = {
  padding: '10px 18px',
  borderRadius: 'var(--r-pill)',
  background: 'var(--brand)',
  color: 'var(--brand-ink)',
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: '13px',
  letterSpacing: '0.02em',
  boxShadow: 'var(--sh-tile)',
  border: 'none',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
} as const

const SECONDARY_CTA_STYLE = {
  padding: '10px 16px',
  borderRadius: 'var(--r-pill)',
  background: 'transparent',
  color: 'var(--canvas-dark-ink)',
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: '13px',
  letterSpacing: '0.02em',
  border: '1px solid var(--canvas-dark-300)',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
} as const

export function DualHero({ book, hive, locale }: Props) {
  const [createHiveOpen, setCreateHiveOpen] = useState(false)

  return (
    <>
      <div
        className="dual-hero-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          gap: '14px',
        }}
      >
        {/* ── Book tile ── */}
        <div style={{ ...TILE_BASE_STYLE, background: PANEL_BG_BOOK }}>
          {book ? (
            <>
              <div style={EYEBROW_STYLE}>Resume your book</div>
              <h2 style={TITLE_STYLE}>{book.title}</h2>
              <p style={SUBLINE_STYLE}>
                Chapter {Math.max(1, book.chapterCount)} ·{' '}
                {book.wordCount.toLocaleString()} words ·{' '}
                {formatRelative(book.lastEditedAt)}
              </p>
              <div
                className="flex flex-wrap items-center gap-2"
                style={{ marginTop: 'auto', paddingTop: '24px' }}
              >
                <Link
                  href={`/${locale}/studio/${book.id}`}
                  style={PRIMARY_CTA_STYLE}
                >
                  Open editor →
                </Link>
                <Link
                  href={`/${locale}/studio/new`}
                  style={SECONDARY_CTA_STYLE}
                >
                  <Plus size={14} strokeWidth={2.5} />
                  New book
                </Link>
              </div>
            </>
          ) : (
            <>
              <div style={EYEBROW_STYLE}>Resume your book</div>
              <h2 style={TITLE_STYLE}>Start your first book</h2>
              <p style={SUBLINE_STYLE}>
                Your library is empty — your next manuscript starts here.
              </p>
              <div
                className="flex flex-wrap items-center gap-2"
                style={{ marginTop: 'auto', paddingTop: '24px' }}
              >
                <Link
                  href={`/${locale}/studio/new`}
                  style={PRIMARY_CTA_STYLE}
                >
                  <Plus size={14} strokeWidth={2.5} />
                  New book
                </Link>
              </div>
            </>
          )}
        </div>

        {/* ── Hive tile ── */}
        <div style={{ ...TILE_BASE_STYLE, background: PANEL_BG_HIVE }}>
          {hive ? (
            <>
              <div style={EYEBROW_STYLE}>Your active hive</div>
              <h2 style={TITLE_STYLE}>{hive.name}</h2>
              <p style={SUBLINE_STYLE}>
                {hive.memberCount}{' '}
                {hive.memberCount === 1 ? 'member' : 'members'} ·{' '}
                {hive.lastActiveAt
                  ? `Last active ${formatRelative(hive.lastActiveAt)}`
                  : 'No activity yet'}
              </p>
              <div
                className="flex flex-wrap items-center gap-2"
                style={{ marginTop: 'auto', paddingTop: '24px' }}
              >
                <Link
                  href={`/${locale}/hive/${hive.id}`}
                  style={PRIMARY_CTA_STYLE}
                >
                  Open hive →
                </Link>
              </div>
            </>
          ) : (
            <>
              <div style={EYEBROW_STYLE}>Your active hive</div>
              <h2 style={TITLE_STYLE}>Start a hive</h2>
              <p style={SUBLINE_STYLE}>
                Collaborate with beta readers and co-authors.
              </p>
              <div
                className="flex flex-wrap items-center gap-2"
                style={{ marginTop: 'auto', paddingTop: '24px' }}
              >
                <button
                  type="button"
                  onClick={() => setCreateHiveOpen(true)}
                  style={PRIMARY_CTA_STYLE}
                >
                  <Plus size={14} strokeWidth={2.5} />
                  New hive
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .dual-hero-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <CreateHiveModal open={createHiveOpen} onOpenChange={setCreateHiveOpen} />
    </>
  )
}
