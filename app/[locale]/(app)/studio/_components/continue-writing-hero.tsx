import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { BookSummary } from '@/lib/actions/book.actions'

type Props = {
  book: BookSummary | null
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

/** "1 chapter" / "12 chapters" with optional " · Genre" suffix. */
function bookSubtitle(book: BookSummary): string {
  const noun = book.chapterCount === 1 ? 'chapter' : 'chapters'
  const head = `${book.chapterCount} ${noun}`
  return book.genre ? `${head} · ${book.genre}` : head
}

const PANEL_STYLE = {
  padding: '36px 40px 38px',
  borderRadius: 'var(--r-card)',
  background:
    'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
  border: 'var(--br-card)',
  color: 'var(--canvas-dark-ink)',
  fontFamily: 'var(--font-ui)',
  boxShadow: 'var(--sh-card)',
} as const

/**
 * Continue-Writing hero — full-width panel above the books-grid / hive-rail split.
 *
 * Same panel chrome as the rail (`--canvas-dark-250 → -200`). No radial gradients.
 * When `book` is null (no books yet), renders an "empty" variant that pitches a
 * new book.
 */
export function ContinueWritingHero({ book, locale }: Props) {
  if (!book) {
    return (
      <div style={PANEL_STYLE} className="relative w-full">
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
            Start your library
          </span>
        </div>
        <h2
          className="m-0 mb-3"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '40px',
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            color: 'var(--canvas-dark-ink-strong)',
          }}
        >
          Your next manuscript starts here.
        </h2>
        <p
          className="m-0 mb-6"
          style={{
            fontFamily: 'var(--font-prose)',
            fontSize: '17px',
            lineHeight: 1.4,
            color: 'var(--canvas-dark-ink)',
            maxWidth: '540px',
          }}
        >
          Spin up a new book and the editor will be ready when you are.
        </p>
        <Link
          href={`/${locale}/studio/new`}
          className="inline-flex items-center gap-2 no-underline"
          style={{
            padding: '12px 20px',
            borderRadius: 'var(--r-pill)',
            background: 'var(--brand)',
            color: 'var(--brand-ink)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '14px',
            letterSpacing: '0.02em',
            boxShadow: 'var(--sh-tile)',
          }}
        >
          <Plus size={16} strokeWidth={2.5} />
          New Book
        </Link>
      </div>
    )
  }

  const hasChapters = book.chapterCount > 0

  return (
    <div style={PANEL_STYLE} className="relative w-full continue-writing-panel">
      {/* Top meta strip */}
      <div
        className="flex items-center gap-3.5 uppercase mb-4 flex-wrap continue-writing-meta"
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
        <span>Last edited {formatRelative(book.lastEditedAt)}</span>
      </div>

      {/* Body — two columns */}
      <div
        className="grid items-end relative continue-writing-grid"
        style={{
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(260px, 1fr)',
          gap: '40px',
        }}
      >
        {/* LEFT — title block */}
        <div style={{ minWidth: 0 }}>
          <h2
            className="m-0 mb-3 continue-writing-title"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '40px',
              letterSpacing: '-0.03em',
              lineHeight: 1.0,
              color: 'var(--canvas-dark-ink-strong)',
              textWrap: 'balance' as const,
            }}
          >
            {book.title}
          </h2>
          <p
            className="m-0 continue-writing-sub"
            style={{
              fontFamily: 'var(--font-prose)',
              fontSize: '17px',
              lineHeight: 1.35,
              color: 'var(--canvas-dark-ink)',
            }}
          >
            {hasChapters ? (
              bookSubtitle(book)
            ) : (
              <span style={{ color: 'var(--canvas-dark-ink-muted)', fontStyle: 'italic' }}>
                No chapters yet. Open the book to add your first.
              </span>
            )}
          </p>
        </div>

        {/* RIGHT — primary CTA */}
        <div className="flex flex-col gap-4 items-end continue-writing-cta">
          <Link
            href={`/${locale}/studio/${book.id}`}
            aria-label={`Continue writing: ${book.title}`}
            className="inline-flex items-center justify-between transition-colors no-underline group"
            style={{
              gap: '14px',
              minWidth: '180px',
              padding: '12px 18px',
              borderRadius: 'var(--r-row)',
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
              boxShadow: 'var(--sh-tile)',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '14px',
              letterSpacing: '0.005em',
            }}
          >
            Open editor
            <span
              className="inline-flex items-center justify-center"
              style={{
                width: '24px',
                height: '24px',
                borderRadius: 'var(--r-full)',
                background: 'var(--brand-ink)',
                color: 'var(--brand)',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </Link>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .continue-writing-grid {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }
        }
        /* Slimmer on phones (issue #50). Desktop is unchanged. */
        @media (max-width: 767px) {
          .continue-writing-panel { padding: 16px 16px 16px !important; }
          .continue-writing-meta { margin-bottom: 10px !important; }
          .continue-writing-title { font-size: 22px !important; line-height: 1.12 !important; margin-bottom: 4px !important; }
          .continue-writing-sub { font-size: 14px !important; line-height: 1.3 !important; }
          .continue-writing-grid { gap: 14px !important; }
          .continue-writing-cta { align-items: stretch !important; }
          .continue-writing-cta > a { min-width: 0 !important; width: 100% !important; padding: 10px 16px !important; }
        }
      `}</style>
    </div>
  )
}
