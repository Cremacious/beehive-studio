'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bookmark } from 'lucide-react'
import { toast } from 'sonner'
import { toggleBookmarkAction } from '@/lib/actions/social.actions'
import type { BookmarkedBook } from '@/lib/actions/library.actions'
import { GENRE_LABEL } from '@/lib/discover/genres'
import { HoneycombCover } from '@/components/book/honeycomb-cover'

type Props = {
  rows: BookmarkedBook[]
  locale: string
}

export function BookmarksGrid({ rows, locale }: Props) {
  return (
    <div
      className="grid gap-[18px]"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
    >
      {rows.map((row) => (
        <BookmarkCard key={row.id} row={row} locale={locale} />
      ))}
    </div>
  )
}

const GENRE_ACCENT: Record<string, { bg: string; color: string }> = {
  fantasy: { bg: 'oklch(0.42 0.13 290 / 0.25)', color: 'oklch(0.85 0.13 290)' },
  'sci-fi': { bg: 'oklch(0.42 0.12 200 / 0.25)', color: 'oklch(0.85 0.12 200)' },
  romance: { bg: 'oklch(0.46 0.14 10 / 0.25)', color: 'oklch(0.85 0.14 10)' },
  mystery: { bg: 'oklch(0.38 0.10 250 / 0.25)', color: 'oklch(0.85 0.10 250)' },
  horror: { bg: 'oklch(0.38 0.10 30 / 0.30)', color: 'oklch(0.85 0.10 30)' },
  thriller: { bg: 'oklch(0.40 0.12 0 / 0.25)', color: 'oklch(0.85 0.12 0)' },
  historical: { bg: 'oklch(0.42 0.10 80 / 0.25)', color: 'oklch(0.85 0.10 80)' },
  contemporary: { bg: 'oklch(0.42 0.10 150 / 0.25)', color: 'oklch(0.85 0.10 150)' },
  literary: { bg: 'oklch(0.45 0.11 60 / 0.25)', color: 'oklch(0.85 0.11 60)' },
  ya: { bg: 'oklch(0.45 0.13 320 / 0.25)', color: 'oklch(0.85 0.13 320)' },
  adventure: { bg: 'oklch(0.43 0.13 100 / 0.25)', color: 'oklch(0.85 0.13 100)' },
  drama: { bg: 'oklch(0.43 0.11 350 / 0.25)', color: 'oklch(0.85 0.11 350)' },
  poetry: { bg: 'oklch(0.42 0.10 260 / 0.25)', color: 'oklch(0.85 0.10 260)' },
  other: { bg: 'var(--canvas-dark-300)', color: 'var(--canvas-dark-ink-muted)' },
}

function BookmarkCard({ row, locale }: { row: BookmarkedBook; locale: string }) {
  const router = useRouter()
  const [removed, setRemoved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const prev = removed
    setRemoved(true)
    startTransition(async () => {
      const result = await toggleBookmarkAction(row.id)
      if (!result.success || result.data.bookmarked) {
        setRemoved(prev)
        toast.error('Could not remove bookmark')
        return
      }
      toast.success('Bookmark removed')
      router.refresh()
    })
  }

  if (removed) return null

  const readerHref = `/${locale}/books/${row.id}`
  const authorLabel = row.authorUsername
    ? `@${row.authorUsername}`
    : (row.authorDisplayName ?? 'Unknown')
  const progressPct = row.chapterCount > 0
    ? Math.min(100, Math.round((row.chaptersRead / row.chapterCount) * 100))
    : 0
  const genreAccent = row.genre
    ? (GENRE_ACCENT[row.genre.toLowerCase()] ?? GENRE_ACCENT.other)
    : null
  const genreLabel = row.genre
    ? ((GENRE_LABEL as Record<string, string>)[row.genre.toLowerCase()] ?? row.genre)
    : null

  return (
    <Link
      href={readerHref}
      className="block no-underline group h-full"
      aria-label={`Open ${row.title}`}
    >
      <div
        className="overflow-hidden h-full flex flex-col transition-transform hover:-translate-y-px"
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          borderRadius: '14px',
          boxShadow: 'var(--sh-tile)',
        }}
      >
        {/* Cover — uploaded image OR brand-yellow honeycomb default */}
        <div className="relative w-full" style={{ aspectRatio: '2 / 3' }}>
          <HoneycombCover src={row.coverUrl} alt={row.title} uid={row.id} />
          <button
            type="button"
            onClick={handleRemove}
            disabled={isPending}
            aria-label="Remove bookmark"
            title="Remove bookmark"
            className="absolute top-2 right-2 p-1.5 rounded-full transition-opacity disabled:opacity-50 opacity-0 group-hover:opacity-100 focus:opacity-100"
            style={{ background: 'rgba(0, 0, 0, 0.55)', color: 'var(--brand)' }}
          >
            <Bookmark className="h-4 w-4" fill="currentColor" aria-hidden="true" />
          </button>
        </div>

        <div className="p-[14px] flex-1 flex flex-col gap-1.5">
          {genreLabel && genreAccent ? (
            <span
              className="inline-block self-start px-2 py-0.5 text-[9px] font-bold uppercase"
              style={{
                background: genreAccent.bg,
                color: genreAccent.color,
                borderRadius: 'var(--r-pill)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.06em',
              }}
            >
              {genreLabel}
            </span>
          ) : null}
          <h3
            className="m-0 text-[14px] font-bold leading-tight"
            style={{
              color: 'var(--canvas-dark-ink-strong)',
              fontFamily: 'var(--font-display)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: '2.6em',
            }}
          >
            {row.title}
          </h3>
          <span
            className="text-[10.5px] truncate"
            style={{
              color: 'var(--canvas-dark-ink-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {authorLabel}
          </span>
          <div
            className="mt-auto pt-2 flex items-center justify-between gap-2"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9.5px',
              color: 'var(--canvas-dark-ink-faint)',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <span>{progressLabel(row)}</span>
            {row.chapterCount > 0 ? (
              <div
                className="h-1.5 rounded-full overflow-hidden flex-shrink-0"
                style={{
                  width: '60px',
                  background: 'var(--canvas-dark-100)',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
                }}
              >
                <div
                  className="h-full"
                  style={{ width: `${progressPct}%`, background: 'var(--brand)', borderRadius: '999px' }}
                />
              </div>
            ) : (
              <span>{formatBookmarkedAt(row.bookmarkedAt)}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

function progressLabel(row: BookmarkedBook): string {
  if (row.derivedStatus === 'finished') return 'Finished'
  if (row.derivedStatus === 'not-started') return 'Not started'
  return `Ch ${row.chaptersRead} of ${row.chapterCount}`
}

function formatBookmarkedAt(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const ms = Date.now() - date.getTime()
  const day = 24 * 60 * 60 * 1000
  if (ms < day) return 'today'
  if (ms < 2 * day) return 'yesterday'
  const days = Math.floor(ms / day)
  if (days < 30) return `${days}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
