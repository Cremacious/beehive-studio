'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Globe, Lock, Users, Heart, Bookmark, Share2, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { toggleBookLikeAction, toggleBookmarkAction } from '@/lib/actions/social.actions'
import type { PublicBook } from '@/lib/actions/discover.actions'
import { ShareBookDialog } from './share-book-dialog'

type Visibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE'

type Props = {
  book: PublicBook & { visibility: Visibility; commentCount: number }
  locale: string
  shareUrl: string
  isAuthenticated: boolean
  startReadingHref: string | null
  continueReadingHref: string | null
  totalChapters: number
  readCount: number
  firstPublishedAt: Date | string
  lastUpdatedAt: Date | string
  initialLiked: boolean
  initialBookmarked: boolean
  initialLikeCount: number
}

function formatWordCount(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
}

function fmtDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const VISIBILITY_META: Record<Visibility, { Icon: typeof Globe; label: string }> = {
  PUBLIC: { Icon: Globe, label: 'Public' },
  FRIENDS: { Icon: Users, label: 'Friends' },
  PRIVATE: { Icon: Lock, label: 'Private' },
}

export function BookHero({
  book,
  locale,
  shareUrl,
  isAuthenticated,
  startReadingHref,
  continueReadingHref,
  totalChapters,
  readCount,
  firstPublishedAt,
  lastUpdatedAt,
  initialLiked,
  initialBookmarked,
  initialLikeCount,
}: Props) {
  const [liked, setLiked] = useState(initialLiked)
  const [bookmarked, setBookmarked] = useState(initialBookmarked)
  const [likeCount, setLikeCount] = useState(initialLikeCount)
  const [, startTransition] = useTransition()

  const handleLike = () => {
    if (!isAuthenticated) {
      toast.info('Sign in to favorite this book')
      return
    }
    const next = !liked
    setLiked(next)
    setLikeCount((c) => c + (next ? 1 : -1))
    startTransition(async () => {
      const result = await toggleBookLikeAction(book.id)
      if (!result.success) {
        setLiked(!next)
        setLikeCount((c) => c + (next ? -1 : 1))
        toast.error('Could not update favorite')
      }
    })
  }

  const handleBookmark = () => {
    if (!isAuthenticated) {
      toast.info('Sign in to bookmark this book')
      return
    }
    const next = !bookmarked
    setBookmarked(next)
    startTransition(async () => {
      const result = await toggleBookmarkAction(book.id)
      if (!result.success) {
        setBookmarked(!next)
        toast.error('Could not update bookmark')
      }
    })
  }

  const VisibilityMeta = VISIBILITY_META[book.visibility]
  const readCta = continueReadingHref ?? startReadingHref
  const readCtaLabel = continueReadingHref ? 'Continue Reading →' : 'Start Reading →'

  const stats = [
    {
      label: 'Chapters',
      value:
        isAuthenticated && totalChapters > 0
          ? `${readCount} / ${totalChapters}`
          : String(totalChapters),
    },
    { label: 'Words', value: formatWordCount(book.wordCount) },
    { label: 'Likes', value: String(likeCount) },
    { label: 'Comments', value: String(book.commentCount) },
  ]

  const tileStyle = {
    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    boxShadow: 'var(--sh-tile)',
  } as const

  return (
    <section
      className="rounded-[var(--r-card)] p-6"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
        borderTop: '1px solid var(--br-card)',
      }}
    >
      <div className="grid gap-6 sm:[grid-template-columns:200px_1fr]">
        <div
          className="aspect-[2/3] w-[200px] overflow-hidden rounded-[var(--r-card)]"
          style={{ boxShadow: 'var(--sh-card)' }}
        >
          {book.coverUrl ? (
            <img src={book.coverUrl} alt={book.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-[var(--canvas-dark-350)] to-[var(--canvas-dark-200)]" />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <h1 className="font-comfortaa text-[28px] font-bold leading-tight text-[var(--brand)]">
            {book.title}
          </h1>

          <div className="flex items-center gap-2">
            {book.authorAvatarUrl ? (
              <img
                src={book.authorAvatarUrl}
                alt=""
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <div className="h-6 w-6 rounded-full bg-[var(--canvas-dark-300)]" />
            )}
            <span className="text-sm text-[var(--canvas-dark-ink-muted)]">by</span>
            <Link
              href={`/${locale}/u/${book.authorUsername}`}
              className="text-sm text-[var(--canvas-dark-ink-strong)] hover:underline"
            >
              {book.authorDisplayName ?? `@${book.authorUsername}`}
            </Link>
          </div>

          {book.seriesName && (
            <div className="font-mono text-[11px] uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]">
              {book.seriesNumber !== null ? (
                <>
                  Book {book.seriesNumber} of <span className="italic">{book.seriesName}</span>
                </>
              ) : (
                <>
                  Part of <span className="italic">{book.seriesName}</span>
                </>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {book.genre && (
              <span className="rounded-[var(--r-pill)] bg-[var(--canvas-dark-300)] px-3 py-1 text-xs text-[var(--canvas-dark-ink)]">
                {book.genre}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] bg-[var(--canvas-dark-300)] px-3 py-1 text-xs text-[var(--canvas-dark-ink)]">
              <VisibilityMeta.Icon className="h-3 w-3" />
              {VisibilityMeta.label}
            </span>
            {book.tags?.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="rounded-[var(--r-pill)] bg-[var(--canvas-dark-300)] px-3 py-1 text-xs text-[var(--canvas-dark-ink-muted)]"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap gap-5">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-[10px] uppercase tracking-wide text-[var(--canvas-dark-ink-muted)]">
                  {s.label}
                </p>
                <p className="text-sm font-semibold text-[var(--canvas-dark-ink-strong)]">
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]">
            Published {fmtDate(firstPublishedAt)} · Updated {fmtDate(lastUpdatedAt)}
          </div>

          {book.synopsis && (
            <p className="line-clamp-3 max-w-xl text-sm leading-relaxed text-[var(--canvas-dark-ink)]">
              {book.synopsis}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {readCta && (
              <Link
                href={readCta}
                className="inline-flex items-center gap-1.5 rounded-[var(--r-btn)] bg-[var(--brand)] px-5 py-2 text-sm font-semibold text-[var(--brand-ink)] hover:brightness-110"
              >
                <BookOpen className="h-4 w-4" />
                {readCtaLabel}
              </Link>
            )}
            <button
              onClick={handleLike}
              aria-pressed={liked}
              className="inline-flex items-center gap-1.5 rounded-[var(--r-btn)] px-4 py-2 text-sm text-[var(--canvas-dark-ink)]"
              style={tileStyle}
            >
              <Heart className={`h-4 w-4 ${liked ? 'fill-current text-[var(--brand)]' : ''}`} />
              {liked ? 'Favorited' : 'Favorite'}
            </button>
            <ShareBookDialog
              url={shareUrl}
              visibility={book.visibility}
              trigger={
                <button
                  className="inline-flex items-center gap-1.5 rounded-[var(--r-btn)] px-4 py-2 text-sm text-[var(--canvas-dark-ink)]"
                  style={tileStyle}
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
              }
            />
            <button
              onClick={handleBookmark}
              aria-pressed={bookmarked}
              className="inline-flex items-center gap-1.5 rounded-[var(--r-btn)] px-4 py-2 text-sm text-[var(--canvas-dark-ink)]"
              style={tileStyle}
            >
              <Bookmark
                className={`h-4 w-4 ${bookmarked ? 'fill-current text-[var(--brand)]' : ''}`}
              />
              {bookmarked ? 'Bookmarked' : 'Bookmark'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
