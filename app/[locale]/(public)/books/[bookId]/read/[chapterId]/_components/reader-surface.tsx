'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight, BookOpen } from 'lucide-react'
import { useReaderTheme, type ReaderTheme } from '@/lib/hooks/use-reader-theme'
import {
  useReaderFontSize,
  READER_FONT_SIZE_LABELS,
} from '@/lib/hooks/use-reader-font-size'
import { ChapterContributionByline } from './chapter-contribution-byline'

type ContributionByline = {
  chapterAuthor: { username: string | null; displayName: string | null }
  bookAuthor: { username: string | null; displayName: string | null }
  bookTitle: string
  locale: string
}

type ChapterNeighbor = {
  href: string
  title: string
  collectionName?: string | null
}

type Props = {
  htmlContent: string
  // Optional: render this React node as the page body INSTEAD of
  // dangerouslySetInnerHTML(htmlContent). Used by front/back matter pages,
  // which need React components rather than a TipTap-derived HTML string.
  bodyOverride?: React.ReactNode
  chapterTitle: string
  chapterNumber: number
  totalChapters: number
  wordCount: number
  bookTitle: string
  backHref: string
  // When set (e.g. for front/back matter), replaces the "Chapter N of M"
  // header subtitle. The wordCount + chapter index logic still passes 0
  // for FBM but the chrome shows this label instead.
  headerSubtitleOverride?: string | null
  prev: ChapterNeighbor | null
  next: ChapterNeighbor | null
  contributionByline: ContributionByline | null
  commentsSlot?: React.ReactNode
}

const THEME_TILES: ReadonlyArray<{
  id: ReaderTheme
  label: string
  fill: string
  ink: string
}> = [
  { id: 'dark', label: 'Dark mode', fill: '#2d2e2f', ink: '#e8e8e8' },
  { id: 'white', label: 'Paper', fill: '#ffffff', ink: '#1a1a1a' },
  { id: 'cream', label: 'Cream paper', fill: '#f5ecd7', ink: '#3a2f1f' },
]

export function ReaderSurface({
  htmlContent,
  chapterTitle,
  chapterNumber,
  totalChapters,
  headerSubtitleOverride,
  bodyOverride,
  wordCount,
  bookTitle,
  backHref,
  prev,
  next,
  commentsSlot,
  contributionByline,
}: Props) {
  const [theme, setTheme] = useReaderTheme()
  const { size, increment, decrement, canIncrement, canDecrement } =
    useReaderFontSize()

  return (
    <div className="min-h-screen bg-[#232425]">
      {/* ① TOP BAR */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          background: '#232425',
          borderColor: 'var(--canvas-dark-350)',
        }}
      >
        {/* Desktop top bar — single row. Hidden below md; the phone layout
            (two stacked rows) renders separately underneath. */}
        <div
          className="mx-auto hidden items-center gap-5 px-4 py-3 md:grid"
          style={{
            maxWidth: '1080px',
            gridTemplateColumns: '1fr minmax(0, auto) 1fr',
          }}
        >
          {/* LEFT — back to book */}
          <Link
            href={backHref}
            aria-label={`Back to ${bookTitle}`}
            className="group inline-flex items-center gap-1.5 justify-self-start rounded-full py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-[var(--canvas-dark-300)]"
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            <ChevronLeft className="h-4 w-4 shrink-0" style={{ color: 'var(--brand)' }} />
            <span className="whitespace-nowrap text-xs font-medium font-ui group-hover:text-[var(--brand)]">
              To Book
            </span>
          </Link>

          {/* CENTER — chapter context */}
          <div className="min-w-0 text-center">
            <div
              className="mx-auto truncate uppercase"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '11px',
                fontWeight: 500,
                letterSpacing: '0.09em',
                color: 'rgba(255,255,255,0.7)',
                maxWidth: '420px',
              }}
            >
              {bookTitle}
            </div>
            <div
              className="mx-auto truncate"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: '#ffffff',
                marginTop: '2px',
                maxWidth: '420px',
              }}
            >
              {chapterTitle}
            </div>
          </div>

          {/* RIGHT — font-size stepper + reader-theme toggle */}
          <div className="flex items-center gap-3 justify-self-end">
            {/* Section label for the accessibility cluster */}
            <span
              aria-hidden="true"
              className="uppercase whitespace-nowrap"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.16em',
                color: 'rgba(255,255,255,0.5)',
                marginRight: '2px',
              }}
            >
              Accessibility
            </span>

            {/* Font-size stepper */}
            <div
              role="group"
              aria-label="Reader font size"
              className="flex items-center gap-2"
            >
              <FontSizeButton
                direction="decrement"
                disabled={!canDecrement}
                onClick={decrement}
                tooltipLabel={READER_FONT_SIZE_LABELS[size]}
              />
              <FontSizeButton
                direction="increment"
                disabled={!canIncrement}
                onClick={increment}
                tooltipLabel={READER_FONT_SIZE_LABELS[size]}
              />
            </div>

            {/* Hairline separator */}
            <span
              aria-hidden="true"
              className="h-6 w-px"
              style={{ background: 'var(--canvas-dark-350)' }}
            />

            {/* Theme toggle */}
            <div
              role="group"
              aria-label="Reader background theme"
              className="flex items-center gap-2"
            >
              <ThemeTiles theme={theme} setTheme={setTheme} />
            </div>
          </div>
        </div>

        {/* Phone top bar — two stacked rows so the back link, title, and the
            accessibility controls each get room. Hidden at md+ (desktop bar
            above takes over). Shares the same theme + font-size state. */}
        <div className="md:hidden">
          <div
            className="grid items-center gap-2 px-3 py-2.5"
            style={{ gridTemplateColumns: 'auto minmax(0, 1fr) auto' }}
          >
            <Link
              href={backHref}
              aria-label={`Back to ${bookTitle}`}
              className="group inline-flex items-center gap-1 justify-self-start rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-[var(--canvas-dark-300)]"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              <ChevronLeft className="h-4 w-4 shrink-0" style={{ color: 'var(--brand)' }} />
              <span className="whitespace-nowrap text-xs font-medium font-ui group-hover:text-[var(--brand)]">
                Book
              </span>
            </Link>
            <div className="min-w-0 text-center">
              <div
                className="mx-auto truncate uppercase"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '9.5px',
                  fontWeight: 500,
                  letterSpacing: '0.09em',
                  color: 'rgba(255,255,255,0.6)',
                }}
              >
                {bookTitle}
              </div>
              <div
                className="mx-auto truncate"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  color: '#ffffff',
                  marginTop: '1px',
                }}
              >
                {chapterTitle}
              </div>
            </div>
            {/* Spacer to balance the back link so the title stays centered. */}
            <span aria-hidden="true" style={{ width: '28px' }} />
          </div>

          {/* Row 2 — accessibility toolbar with roomy, finger-sized targets */}
          <div
            className="flex items-center justify-between gap-2 px-3 pb-3 pt-2.5"
            style={{ borderTop: '1px solid var(--canvas-dark-300)' }}
          >
            <div role="group" aria-label="Reader font size" className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="uppercase"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  letterSpacing: '0.14em',
                  color: 'rgba(255,255,255,0.45)',
                }}
              >
                Text
              </span>
              <MobileFontButton
                direction="decrement"
                disabled={!canDecrement}
                onClick={decrement}
                tooltipLabel={READER_FONT_SIZE_LABELS[size]}
              />
              <MobileFontButton
                direction="increment"
                disabled={!canIncrement}
                onClick={increment}
                tooltipLabel={READER_FONT_SIZE_LABELS[size]}
              />
            </div>
            <div
              role="group"
              aria-label="Reader background theme"
              className="flex items-center gap-2.5"
            >
              <span
                aria-hidden="true"
                className="uppercase"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  letterSpacing: '0.14em',
                  color: 'rgba(255,255,255,0.45)',
                }}
              >
                Theme
              </span>
              <ThemeTiles theme={theme} setTheme={setTheme} size={38} />
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Contribution byline (lives in dark chrome so it stays readable across all reader themes) */}
        {contributionByline && (
          <div
            className="mx-auto px-4 pt-6 text-center"
            style={{ maxWidth: '760px' }}
          >
            <ChapterContributionByline
              chapterAuthor={contributionByline.chapterAuthor}
              bookAuthor={contributionByline.bookAuthor}
              bookTitle={contributionByline.bookTitle}
              locale={contributionByline.locale}
            />
          </div>
        )}

        {/* ② PROSE PANEL — flips with reader theme */}
        <article
          data-reader-theme={theme}
          className="reader-prose mx-auto"
          style={{
            maxWidth: '760px',
            margin: '32px auto',
            padding: '56px 64px',
            background: 'var(--prose-bg)',
            color: 'var(--prose-ink)',
            border: '1px solid var(--prose-rule)',
            borderRadius: '20px',
            fontFamily: 'var(--font-prose)',
            fontSize: '18px',
            lineHeight: 1.75,
            transition: 'background .22s ease, color .22s ease, border-color .22s ease',
          }}
        >
          {/* Chapter header — suppressed entirely for front/back matter
              (bodyOverride is set). The FBM display components carry their
              own title + styling, so the chapter chrome (eyebrow, h1, word
              count, divider) would just duplicate or contradict the body. */}
          {!bodyOverride && (
            <>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--prose-ink-muted)',
                  margin: 0,
                }}
              >
                {headerSubtitleOverride ?? `Chapter ${chapterNumber} of ${totalChapters}`}
              </p>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: '32px',
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                  color: 'var(--prose-ink-strong)',
                  margin: '8px 0 0',
                  textWrap: 'balance' as never,
                }}
              >
                {chapterTitle}
              </h1>
              <p
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '12px',
                  letterSpacing: '0.02em',
                  color: 'var(--prose-ink-muted)',
                  margin: '12px 0 0',
                }}
              >
                {wordCount.toLocaleString()} words
              </p>
              <hr
                style={{
                  border: 0,
                  borderTop: '1px solid var(--prose-rule)',
                  marginBlock: '32px',
                }}
              />
            </>
          )}

          {/* Chapter body — flips via CSS custom props on .prose-chapter.
              font-size is reader-controlled via the A- / A+ stepper above
              (headings inside .prose-chapter use em units so they scale).
              When bodyOverride is set (front/back matter pages), render the
              React node directly; chapters stay on the dangerouslySetInnerHTML
              path because TipTap content is already HTML. */}
          {bodyOverride ? (
            <div className="prose-chapter" style={{ fontSize: size }}>
              {bodyOverride}
            </div>
          ) : (
            <div
              className="prose-chapter"
              style={{ fontSize: size }}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          )}

          {/* End-of-chapter divider — chapter-only. FBM pages skip it
              (a "title page" or "copyright" doesn't conceptually end a
              "chapter"). */}
          {!bodyOverride && (
            <div
              className="flex items-center"
              style={{
                gap: '16px',
                marginTop: '40px',
                fontFamily: 'var(--font-ui)',
                fontSize: '12px',
                letterSpacing: '0.04em',
                color: 'var(--prose-ink-muted)',
              }}
            >
              <span
                aria-hidden="true"
                style={{ flex: 1, height: '1px', background: 'var(--prose-rule)' }}
              />
              End of chapter
              <span
                aria-hidden="true"
                style={{ flex: 1, height: '1px', background: 'var(--prose-rule)' }}
              />
            </div>
          )}
        </article>

        {commentsSlot && (
          <div
            className="reader-comments-slot mx-auto"
            style={{ maxWidth: '900px', padding: '32px 24px 16px' }}
          >
            {commentsSlot}
          </div>
        )}

        {/* ③ NAV ROW — dark chrome */}
        <nav
          aria-label="Chapter navigation"
          className="mx-auto px-4 py-6"
          style={{ maxWidth: '1080px' }}
        >
          <div
            className="reader-nav-grid grid gap-4"
            style={{ gridTemplateColumns: '1fr 1fr 1fr' }}
          >
            {/* PREV */}
            {prev ? (
              <NavCard
                href={prev.href}
                dir="prev"
                title={prev.title}
                collectionName={prev.collectionName ?? null}
              />
            ) : (
              <span />
            )}

            {/* BACK TO BOOK (always present) */}
            <NavBackCard href={backHref} bookTitle={bookTitle} />

            {/* NEXT */}
            {next ? (
              <NavCard
                href={next.href}
                dir="next"
                title={next.title}
                collectionName={next.collectionName ?? null}
              />
            ) : (
              <span />
            )}
          </div>
        </nav>
      </main>
    </div>
  )
}

function ThemeTiles({
  theme,
  setTheme,
  size = 32,
}: {
  theme: ReaderTheme
  setTheme: (t: ReaderTheme) => void
  size?: number
}) {
  return (
    <>
      {THEME_TILES.map(tile => {
        const active = theme === tile.id
        return (
          <button
            key={tile.id}
            type="button"
            aria-label={tile.label}
            title={tile.label}
            aria-pressed={active}
            onClick={() => setTheme(tile.id)}
            className="relative inline-flex items-center justify-center transition-all hover:-translate-y-px"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              borderRadius: size >= 36 ? '13px' : '14px',
              background: tile.fill,
              color: tile.ink,
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: size >= 36 ? '13px' : '12px',
              lineHeight: 1,
              border: active ? '2px solid var(--brand)' : '1px solid var(--canvas-dark-350)',
              boxShadow: active ? '0 0 0 3px rgba(255,195,0,0.18)' : 'none',
              padding: 0,
            }}
          >
            Aa
          </button>
        )
      })}
    </>
  )
}

// Compact font-size stepper for the phone toolbar — short "A−" / "A+" labels
// with a 40px tap target (the desktop FontSizeButton's full "− Font Size"
// label is far too wide for a phone row).
function MobileFontButton({
  direction,
  disabled,
  onClick,
  tooltipLabel,
}: {
  direction: 'increment' | 'decrement'
  disabled: boolean
  onClick: () => void
  tooltipLabel: string
}) {
  const isIncrement = direction === 'increment'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${isIncrement ? 'Increase' : 'Decrease'} font size${
        disabled ? (isIncrement ? ' (at maximum)' : ' (at minimum)') : ''
      }`}
      title={`Font size: ${tooltipLabel}`}
      className="inline-flex items-center justify-center transition-transform active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        height: '40px',
        minWidth: '48px',
        padding: '0 12px',
        gap: '2px',
        borderRadius: '12px',
        background: 'var(--canvas-dark-150)',
        color: 'rgba(255,255,255,0.9)',
        border: '1px solid var(--canvas-dark-350)',
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span style={{ fontSize: '14px' }}>A</span>
      <span style={{ fontSize: '18px', lineHeight: 1 }}>{isIncrement ? '+' : '−'}</span>
    </button>
  )
}

function FontSizeButton({
  direction,
  disabled,
  onClick,
  tooltipLabel,
}: {
  direction: 'increment' | 'decrement'
  disabled: boolean
  onClick: () => void
  tooltipLabel: string
}) {
  const isIncrement = direction === 'increment'
  const label = isIncrement ? '+ Font Size' : '− Font Size'
  const ariaAction = isIncrement ? 'Increase font size' : 'Decrease font size'
  const ariaBoundary = isIncrement ? ' (at maximum)' : ' (at minimum)'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${ariaAction}${disabled ? ariaBoundary : ''}`}
      title={`Font size: ${tooltipLabel}`}
      className="inline-flex items-center justify-center whitespace-nowrap transition-all hover:-translate-y-px disabled:opacity-40 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
      style={{
        height: '26px',
        padding: '0 9px',
        borderRadius: '12px',
        background: 'var(--canvas-dark-150)',
        color: 'rgba(255,255,255,0.85)',
        border: '1px solid var(--canvas-dark-350)',
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        fontSize: '10.5px',
        letterSpacing: '-0.005em',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function NavCard({
  href,
  dir,
  title,
  collectionName,
}: {
  href: string
  dir: 'prev' | 'next'
  title: string
  collectionName: string | null
}) {
  const isPrev = dir === 'prev'
  return (
    <Link
      href={href}
      aria-label={isPrev ? 'Previous chapter' : 'Next chapter'}
      className="group flex items-center gap-3.5 no-underline transition-all hover:-translate-y-px"
      style={{
        flexDirection: isPrev ? 'row' : 'row-reverse',
        textAlign: isPrev ? 'left' : 'right',
        padding: '16px 20px',
        background: 'var(--canvas-dark-150)',
        border: '1px solid var(--canvas-dark-350)',
        borderRadius: '16px',
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.04) inset, 0 3px 0 rgba(0,0,0,0.32)',
        color: 'inherit',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow =
          '0 1px 0 rgba(255,255,255,0.05) inset, 0 4px 0 rgba(0,0,0,0.38)'
        e.currentTarget.style.borderColor = 'rgba(255,195,0,0.32)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow =
          '0 1px 0 rgba(255,255,255,0.04) inset, 0 3px 0 rgba(0,0,0,0.32)'
        e.currentTarget.style.borderColor = 'var(--canvas-dark-350)'
      }}
    >
      {isPrev ? (
        <ChevronLeft
          className="shrink-0"
          style={{ width: '20px', height: '20px', color: 'var(--brand)' }}
        />
      ) : (
        <ChevronRight
          className="shrink-0"
          style={{ width: '20px', height: '20px', color: 'var(--brand)' }}
        />
      )}
      <span className="min-w-0 flex-1">
        <span
          className="block uppercase"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.16em',
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          {isPrev ? 'Previous' : 'Next'}
        </span>
        {collectionName && (
          <span
            className="mt-1 block truncate"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.04em',
              color: 'var(--brand)',
            }}
            title={collectionName}
          >
            {collectionName}
          </span>
        )}
        <span
          className="mt-1 block overflow-hidden"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '14px',
            fontWeight: 700,
            letterSpacing: '-0.005em',
            color: '#ffffff',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {title}
        </span>
      </span>
    </Link>
  )
}

function NavBackCard({
  href,
  bookTitle,
}: {
  href: string
  bookTitle: string
}) {
  return (
    <Link
      href={href}
      aria-label="Back to book"
      className="group flex flex-col items-center justify-center gap-2 text-center no-underline transition-all hover:-translate-y-px"
      style={{
        padding: '16px 20px',
        background: 'var(--canvas-dark-150)',
        border: '1px solid var(--canvas-dark-350)',
        borderRadius: '16px',
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.04) inset, 0 3px 0 rgba(0,0,0,0.32)',
        color: 'inherit',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow =
          '0 1px 0 rgba(255,255,255,0.05) inset, 0 4px 0 rgba(0,0,0,0.38)'
        e.currentTarget.style.borderColor = 'rgba(255,195,0,0.32)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow =
          '0 1px 0 rgba(255,255,255,0.04) inset, 0 3px 0 rgba(0,0,0,0.32)'
        e.currentTarget.style.borderColor = 'var(--canvas-dark-350)'
      }}
    >
      <BookOpen
        className="shrink-0"
        style={{ width: '20px', height: '20px', color: 'var(--brand)' }}
      />
      <span
        className="overflow-hidden transition-colors group-hover:text-[var(--brand)]"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '13px',
          fontWeight: 600,
          color: '#ffffff',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {bookTitle}
      </span>
    </Link>
  )
}
