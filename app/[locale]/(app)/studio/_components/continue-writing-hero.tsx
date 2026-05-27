import Link from 'next/link'
import type { BookSummary } from '@/lib/actions/book.actions'

type Props = {
  book: BookSummary
  locale: string
}

function formatRelative(d: Date): string {
  const diff = Date.now() - new Date(d).getTime()
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

/** Map BookSummaryStatus → status-* token + label for the hero genre tag. */
function statusToken(status: BookSummary['status']): { token: string; label: string } {
  switch (status) {
    case 'Published': return { token: 'var(--status-final)', label: 'Published' }
    case 'Revised':   return { token: 'var(--status-revised)', label: 'Revised' }
    case 'Drafting':  return { token: 'var(--status-first-draft)', label: 'Drafting' }
  }
}

export function ContinueWritingHero({ book, locale }: Props) {
  const { token: statusColor, label: statusLabel } = statusToken(book.status)

  // Progress against a default 80k goal until per-book word goals ship.
  // TODO(library-v2): replace 80,000 with a book-level word goal once the
  // schema supports it.
  const WORD_GOAL = 80_000
  const pct = Math.min(100, Math.round((book.wordCount / WORD_GOAL) * 100))

  // We don't currently track the last-edited chapter title — show the
  // chapter count instead so the row reads cleanly with the data we have.
  // TODO(library-v2): wire up last-edited chapter title.
  const chapterLabel =
    book.chapterCount > 0
      ? `Chapter ${book.chapterCount}`
      : 'No chapters yet'

  // Author byline — we don't have a top-level "byline" on BookSummary; the
  // cover uses a neutral placeholder until we wire up the user's pen name.
  const byline = ''

  return (
    <Link
      href={`/${locale}/studio/${book.id}`}
      aria-label={`Continue writing: ${book.title}`}
      className="group relative overflow-hidden no-underline grid"
      style={{
        gridTemplateColumns: '240px 1fr',
        minHeight: '340px',
        borderRadius: 'var(--r-2xl)',
        background: 'var(--canvas-dark-100)',
        border: '1px solid var(--canvas-dark-300)',
        boxShadow: 'var(--el-2)',
        color: 'inherit',
      }}
    >
      {/* LEFT — rotated paper cover */}
      <div className="relative z-[1] flex items-center" style={{ padding: '36px 0 36px 36px' }}>
        <div
          className="relative flex flex-col justify-between"
          style={{
            width: '180px',
            height: '268px',
            borderRadius: '4px 8px 8px 4px',
            boxShadow: 'var(--el-paper)',
            background: 'var(--paper-100)',
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(95,60,20,0.04) 1px, transparent 0)',
            backgroundSize: '22px 22px',
            padding: '26px 18px 22px',
            fontFamily: 'var(--font-display)',
            color: 'var(--paper-ink-strong)',
            transform: 'rotate(-1.2deg)',
            transformOrigin: 'bottom right',
          }}
          aria-hidden="true"
        >
          {/* spine shadow */}
          <span
            className="absolute left-0 top-0 bottom-0"
            style={{
              width: '8px',
              background: 'linear-gradient(90deg, oklch(0.65 0.025 60 / 0.30) 0%, oklch(0.78 0.022 78 / 0.18) 40%, transparent 100%)',
              borderRadius: '4px 0 0 4px',
            }}
          />
          {/* Crown stamp */}
          <div className="mt-4 mx-auto" style={{ width: '64px', height: '64px', color: 'var(--paper-ink-strong)', opacity: 0.85 }}>
            <svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round">
              <path d="M10 44 L14 22 L24 32 L32 16 L40 32 L50 22 L54 44 Z" fill="currentColor" fillOpacity="0.18" />
              <circle cx="14" cy="20" r="1.6" fill="currentColor" />
              <circle cx="32" cy="14" r="1.6" fill="currentColor" />
              <circle cx="50" cy="20" r="1.6" fill="currentColor" />
              <path d="M10 48 L54 48" />
            </svg>
          </div>
          <div>
            <div
              className="text-center"
              style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.05, textWrap: 'balance' as const }}
            >
              {book.title}
            </div>
            <div className="mx-auto" style={{ width: '36px', height: '1px', background: 'var(--paper-ink-strong)', margin: '12px auto 10px', opacity: 0.5 }} />
            <div
              className="text-center uppercase"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                letterSpacing: '0.24em',
                color: 'var(--paper-ink-muted)',
              }}
            >
              {byline || book.genre || 'Beehive Studio'}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT — body */}
      <div className="relative z-[1] flex flex-col" style={{ padding: '32px 36px 32px 40px' }}>
        {/* Eyebrow */}
        <div
          className="inline-flex items-center gap-2.5 uppercase mb-3.5"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.16em',
            color: 'var(--canvas-dark-ink-muted)',
          }}
        >
          <span
            className="inline-block"
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--brand)',
              boxShadow: '0 0 0 3px var(--brand-soft)',
            }}
          />
          <span>Continue writing</span>
        </div>

        {/* Title */}
        <h2
          className="m-0 mb-4"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '38px',
            letterSpacing: '-0.025em',
            lineHeight: 1.05,
            color: 'var(--canvas-dark-ink-strong)',
            textWrap: 'balance' as const,
          }}
        >
          {book.title}
        </h2>

        {/* Chapter context row */}
        <div
          className="flex items-center gap-3 flex-wrap mb-7"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '15px',
            fontWeight: 500,
            color: 'var(--canvas-dark-ink)',
            lineHeight: 1.45,
          }}
        >
          <span
            className="inline-flex items-center gap-[7px] uppercase"
            style={{
              padding: '5px 11px 5px 9px',
              borderRadius: 'var(--r-full)',
              background: `oklch(from ${statusColor} l c h / 0.16)`,
              border: `1px solid oklch(from ${statusColor} l c h / 0.32)`,
              color: statusColor,
              fontFamily: 'var(--font-display)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.04em',
            }}
          >
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: statusColor }} />
            {statusLabel}
          </span>
          <span style={{ color: 'var(--canvas-dark-ink-strong)', fontWeight: 600 }}>{chapterLabel}</span>
          <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--canvas-dark-300)' }} />
          <span>Last edited {formatRelative(book.lastEditedAt)}</span>
        </div>

        {/* Progress */}
        <div className="flex flex-col gap-2.5" aria-label="Word goal progress">
          <div
            className="relative overflow-hidden"
            style={{
              height: '8px',
              borderRadius: 'var(--r-full)',
              background: 'var(--canvas-dark-200)',
              boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.3)',
            }}
          >
            <span
              className="absolute left-0 top-0 bottom-0"
              style={{
                width: `${pct}%`,
                background: statusColor,
                borderRadius: 'var(--r-full)',
              }}
            />
          </div>
          <div
            className="flex items-baseline justify-between"
            style={{
              fontSize: '13px',
              color: 'var(--canvas-dark-ink-muted)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.04em',
            }}
          >
            <span>
              {book.wordCount.toLocaleString()} of {WORD_GOAL.toLocaleString()} words
            </span>
            <span style={{ color: 'var(--canvas-dark-ink)' }}>
              <b style={{ color: 'var(--canvas-dark-ink-strong)', fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '15px', letterSpacing: 0 }}>
                {pct}%
              </b>
              &nbsp;to first draft
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-7 flex items-center gap-[18px]">
          <span
            className="inline-flex items-center gap-2.5 group-hover:[background:var(--brand-hover)] transition-colors"
            style={{
              padding: '12px 20px',
              borderRadius: 'var(--r-full)',
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '14px',
              letterSpacing: '0.005em',
              boxShadow: 'var(--el-2)',
            }}
          >
            Resume writing
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  )
}
