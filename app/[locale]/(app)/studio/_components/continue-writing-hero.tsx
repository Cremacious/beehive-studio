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
  if (hours === 1) return '1 hour ago'
  if (hours < 24) return `${hours} hours ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

/** Map BookSummaryStatus → status-* token + label. */
function statusToken(status: BookSummary['status']): { token: string; label: string } {
  switch (status) {
    case 'Published': return { token: 'var(--status-final)', label: 'Published' }
    case 'Revised':   return { token: 'var(--status-revised)', label: 'Revised' }
    case 'Drafting':  return { token: 'var(--status-first-draft)', label: 'Drafting' }
  }
}

/**
 * Continue-Writing hero — Library v2.2.
 *
 * Full-width manuscript panel (no longer a 2-col with cover thumbnail).
 * Surface: canvas-dark-150 (one step lighter than the page bg).
 * Layout: top meta strip (eyebrow + status pill + last-edited) → body grid
 *   (title block left, progress + Resume CTA right).
 */
export function ContinueWritingHero({ book, locale }: Props) {
  const { token: statusColor, label: statusLabel } = statusToken(book.status)

  // Progress against a default 80k goal until per-book word goals ship.
  // TODO(library-v2): replace 80,000 with a book-level word goal once the
  // schema supports it.
  const WORD_GOAL = 80_000
  const pct = Math.min(100, Math.round((book.wordCount / WORD_GOAL) * 100))

  // We don't currently track the last-edited chapter title — show the
  // chapter count instead. The serif body line reads "Chapter N" with a
  // following name. For now, show "—" (em dash) instead of a name we
  // don't have.
  // TODO(library-v2): wire up last-edited chapter title.
  const hasChapters = book.chapterCount > 0

  return (
    <Link
      href={`/${locale}/studio/${book.id}`}
      aria-label={`Continue writing: ${book.title}`}
      className="group relative block w-full no-underline overflow-hidden transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-px"
      style={{
        padding: '40px 48px 44px',
        borderRadius: 'var(--r-card)',
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        border: 'var(--br-card)',
        color: 'var(--canvas-dark-ink)',
        fontFamily: 'var(--font-ui)',
        boxShadow: 'var(--sh-card)',
      }}
    >
      {/* Top meta strip */}
      <div
        className="flex items-center gap-3.5 uppercase mb-4"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.16em',
          color: 'var(--canvas-dark-ink-muted)',
        }}
      >
        <span
          className="inline-flex items-center gap-2"
          style={{ color: 'var(--canvas-dark-ink-strong)', fontWeight: 600 }}
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
          Continue writing
        </span>
        <span style={{ width: '1px', height: '12px', background: 'var(--canvas-dark-300)' }} />
        <span
          className="inline-flex items-center gap-1.5 uppercase"
          style={{
            padding: '3px 9px 3px 7px',
            borderRadius: 'var(--r-full)',
            background: `oklch(from ${statusColor} l c h / 0.16)`,
            border: `1px solid oklch(from ${statusColor} l c h / 0.32)`,
            color: statusColor,
            fontFamily: 'var(--font-display)',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.06em',
          }}
        >
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: statusColor }} />
          {statusLabel}
        </span>
        <span style={{ width: '1px', height: '12px', background: 'var(--canvas-dark-300)' }} />
        <span>Last edited {formatRelative(book.lastEditedAt)}</span>
      </div>

      {/* Body — two columns */}
      <div
        className="grid items-end relative"
        style={{
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 1fr)',
          gap: '48px',
        }}
      >
        {/* LEFT — title block */}
        <div style={{ minWidth: 0 }}>
          <h2
            className="m-0 mb-3"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '44px',
              letterSpacing: '-0.03em',
              lineHeight: 1.0,
              color: 'var(--canvas-dark-ink-strong)',
              textWrap: 'balance' as const,
            }}
          >
            {book.title}
          </h2>
          <p
            className="m-0"
            style={{
              fontFamily: 'var(--font-prose)',
              fontSize: '18px',
              lineHeight: 1.35,
              color: 'var(--canvas-dark-ink)',
            }}
          >
            {hasChapters ? (
              <>
                <em
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontStyle: 'normal',
                    fontWeight: 700,
                    fontSize: '14px',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                    color: 'var(--canvas-dark-ink-muted)',
                    marginRight: '8px',
                  }}
                >
                  Chapter {book.chapterCount}
                </em>
                {/* TODO(library-v2): last-edited chapter title */}
                {book.genre ?? '—'}
              </>
            ) : (
              <span style={{ color: 'var(--canvas-dark-ink-muted)', fontStyle: 'italic' }}>
                No chapters yet — open the book to add your first.
              </span>
            )}
          </p>
        </div>

        {/* RIGHT — action stack */}
        <div className="flex flex-col gap-4">
          {/* Progress */}
          <div className="flex flex-col gap-2" aria-label="Word goal progress">
            <div
              className="flex items-baseline justify-between"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.04em',
                color: 'var(--canvas-dark-ink-muted)',
              }}
            >
              <span>
                <b
                  style={{
                    color: 'var(--canvas-dark-ink-strong)',
                    fontFamily: 'var(--font-display)',
                    fontSize: '14px',
                    fontWeight: 700,
                    letterSpacing: 0,
                    marginRight: '4px',
                  }}
                >
                  {book.wordCount.toLocaleString()}
                </b>
                of{' '}
                <b
                  style={{
                    color: 'var(--canvas-dark-ink-strong)',
                    fontFamily: 'var(--font-display)',
                    fontSize: '14px',
                    fontWeight: 700,
                    letterSpacing: 0,
                    marginRight: '4px',
                  }}
                >
                  {WORD_GOAL.toLocaleString()}
                </b>
                words
              </span>
              <span>
                <b
                  style={{
                    color: 'var(--canvas-dark-ink-strong)',
                    fontFamily: 'var(--font-display)',
                    fontSize: '14px',
                    fontWeight: 700,
                    letterSpacing: 0,
                    marginRight: '4px',
                  }}
                >
                  {pct}%
                </b>
                to first draft
              </span>
            </div>
            <div
              className="relative overflow-hidden"
              style={{
                height: '8px',
                borderRadius: 'var(--r-full)',
                background: 'var(--canvas-dark-300)',
              }}
            >
              <span
                className="absolute left-0 top-0 bottom-0"
                style={{
                  width: `${pct}%`,
                  background: statusColor,
                  borderRadius: 'var(--r-full)',
                }}
              >
                {/* dark notch at the end — reads like a paper marker */}
                <span
                  className="absolute"
                  style={{
                    right: 0,
                    top: '-2px',
                    bottom: '-2px',
                    width: '2px',
                    background: `oklch(from ${statusColor} calc(l - 0.15) c h)`,
                  }}
                />
              </span>
            </div>
          </div>

          {/* [BRAND USE 2/5] Resume CTA — full width with circular arrow */}
          <span
            className="inline-flex items-center justify-between w-full transition-colors group-hover:[background:var(--brand-hover)]"
            style={{
              gap: '16px',
              padding: '13px 18px',
              borderRadius: 'var(--r-row)',
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
              boxShadow: 'var(--sh-tile)',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '15px',
              letterSpacing: '0.005em',
            }}
          >
            Resume writing
            <span
              className="inline-flex items-center justify-center"
              style={{
                width: '26px',
                height: '26px',
                borderRadius: 'var(--r-full)',
                background: 'var(--brand-ink)',
                color: 'var(--brand)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </span>
        </div>
      </div>
    </Link>
  )
}
