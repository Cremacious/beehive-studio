'use client'

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Globe,
  Lock,
  Users,
  Heart,
  Bookmark,
  Share2,
  ArrowRight,
  BookOpen,
  FileText,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { toggleBookLikeAction, toggleBookmarkAction } from '@/lib/actions/social.actions'
import { optimizeCloudinaryUrl, BOOK_COVER_TRANSFORMS } from '@/lib/upload/cloudinary-url'
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

  // Synopsis "Read more" expand
  const synopsisRef = useRef<HTMLParagraphElement | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [isTruncated, setIsTruncated] = useState(false)

  useLayoutEffect(() => {
    const el = synopsisRef.current
    if (!el) return
    // Only meaningful when collapsed — when expanded, we leave the prior value.
    if (!expanded) {
      setIsTruncated(el.scrollHeight > el.clientHeight + 2)
    }
  }, [book.synopsis, expanded])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const onResize = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const el = synopsisRef.current
        if (!el || expanded) return
        setIsTruncated(el.scrollHeight > el.clientHeight + 2)
      }, 120)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (timer) clearTimeout(timer)
    }
  }, [expanded])

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
  const readCtaLabel = continueReadingHref ? 'Continue Reading' : 'Start Reading'

  const tileStyle = {
    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    boxShadow: 'var(--sh-tile)',
  } as const

  const recessedStyle = {
    background: 'var(--canvas-dark-100)',
    boxShadow: 'var(--sh-inset)',
  } as const

  const statCells: { label: string; Icon: typeof BookOpen; node: React.ReactNode }[] = [
    {
      label: 'Chapters',
      Icon: BookOpen,
      node:
        totalChapters === 0 ? (
          <>–</>
        ) : isAuthenticated ? (
          <>
            <span style={{ color: 'var(--brand)' }}>{readCount}</span>
            <span style={{ color: 'var(--canvas-dark-ink-faint)', fontWeight: 500 }}> / </span>
            {totalChapters} read
          </>
        ) : (
          <>{totalChapters} chapters</>
        ),
    },
    { label: 'Words', Icon: FileText, node: <>{formatWordCount(book.wordCount)}</> },
    { label: 'Likes', Icon: Heart, node: <>{likeCount}</> },
    { label: 'Comments', Icon: MessageSquare, node: <>{book.commentCount}</> },
  ]

  return (
    <section
      className="relative overflow-hidden rounded-[var(--r-card)]"
      style={{
        padding: '34px',
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
        borderTop: '1px solid var(--br-card)',
      }}
    >
      <div
        className="relative grid"
        style={{ gridTemplateColumns: '200px minmax(0, 1fr)', gap: '34px', alignItems: 'start' }}
      >
        {/* Cover */}
        <div
          className="relative overflow-hidden"
          style={{
            width: '200px',
            height: '300px',
            borderRadius: 'var(--r-row)',
            background: book.coverUrl
              ? undefined
              : 'radial-gradient(120% 80% at 50% -10%, oklch(0.42 0.10 250), transparent 60%), linear-gradient(165deg, oklch(0.34 0.08 255), oklch(0.22 0.06 268))',
            boxShadow:
              '0 1px 0 0 oklch(1 0 0 / 0.10) inset, 0 24px 48px -16px oklch(0 0 0 / 0.6), 0 8px 16px -8px oklch(0 0 0 / 0.4)',
            flexShrink: 0,
          }}
          role="img"
          aria-label={`Cover of ${book.title}`}
        >
          {book.coverUrl ? (
            <img
              src={optimizeCloudinaryUrl(book.coverUrl, BOOK_COVER_TRANSFORMS)}
              alt={book.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <>
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  opacity: 0.5,
                  backgroundImage:
                    'radial-gradient(circle at 1.5px 1.5px, oklch(0.85 0.16 88 / 0.18) 1.5px, transparent 0)',
                  backgroundSize: '20px 18px',
                }}
              />
              <div
                className="absolute inset-0 flex flex-col justify-between"
                style={{ padding: '22px 18px' }}
              >
                {book.seriesNumber !== null && book.seriesName ? (
                  <div
                    className="relative text-center"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '8.5px',
                      letterSpacing: '0.3em',
                      textTransform: 'uppercase',
                      color: 'oklch(0.85 0.12 88 / 0.85)',
                    }}
                  >
                    Book {book.seriesNumber}
                  </div>
                ) : (
                  <div />
                )}
                <div
                  className="relative m-auto"
                  style={{ color: 'oklch(0.86 0.15 88)' }}
                  aria-hidden
                >
                  <svg
                    width="46"
                    height="46"
                    viewBox="0 0 64 64"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  >
                    <path
                      d="M32 6 L52 17.5 L52 40.5 L32 52 L12 40.5 L12 17.5 Z"
                      fill="currentColor"
                      fillOpacity="0.12"
                    />
                    <path
                      d="M32 20 L42 26 L42 38 L32 44 L22 38 L22 26 Z"
                      fill="currentColor"
                      fillOpacity="0.28"
                    />
                  </svg>
                </div>
                <div className="relative text-center">
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: '19px',
                      lineHeight: 1.05,
                      letterSpacing: '-0.01em',
                      color: 'oklch(0.97 0.01 90)',
                      textWrap: 'balance' as 'balance',
                    }}
                  >
                    {book.title}
                  </div>
                  <div
                    style={{
                      width: '26px',
                      height: '1px',
                      margin: '9px auto',
                      background: 'oklch(0.85 0.15 88 / 0.7)',
                    }}
                  />
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '8px',
                      letterSpacing: '0.24em',
                      textTransform: 'uppercase',
                      color: 'oklch(0.88 0.04 90 / 0.75)',
                    }}
                  >
                    {book.authorDisplayName ?? book.authorUsername ?? ''}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Main content */}
        <div className="min-w-0">
          {/* Top row: privacy + series */}
          <div className="mb-[14px] flex flex-wrap items-center gap-3">
            <span
              className="inline-flex items-center"
              style={{
                gap: '7px',
                padding: '5px 11px 5px 9px',
                borderRadius: 'var(--r-pill)',
                fontFamily: 'var(--font-mono)',
                fontSize: '10.5px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--canvas-dark-ink)',
                ...recessedStyle,
              }}
            >
              <VisibilityMeta.Icon
                size={13}
                strokeWidth={1.9}
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              />
              {VisibilityMeta.label}
            </span>
            {book.seriesName && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10.5px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--canvas-dark-ink-muted)',
                }}
              >
                {book.seriesNumber !== null ? (
                  <>
                    Book{' '}
                    <b style={{ color: 'var(--canvas-dark-ink)', fontWeight: 500 }}>
                      {book.seriesNumber}
                    </b>{' '}
                    of{' '}
                    <b style={{ color: 'var(--canvas-dark-ink)', fontWeight: 500 }}>
                      {book.seriesName}
                    </b>
                  </>
                ) : (
                  <>
                    Part of{' '}
                    <b style={{ color: 'var(--canvas-dark-ink)', fontWeight: 500 }}>
                      {book.seriesName}
                    </b>
                  </>
                )}
              </span>
            )}
          </div>

          {/* Title */}
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '40px',
              lineHeight: 1.02,
              letterSpacing: '-0.025em',
              color: 'var(--brand)',
              margin: '0 0 14px',
              textWrap: 'balance' as 'balance',
            }}
          >
            {book.title}
          </h1>

          {/* Author row */}
          <div className="mb-[18px] flex items-center gap-2.5">
            <span style={{ fontSize: '14px', color: 'var(--canvas-dark-ink-muted)' }}>
              Written by{' '}
              <Link
                href={`/${locale}/u/${book.authorUsername ?? ''}`}
                style={{
                  color: 'var(--canvas-dark-ink-strong)',
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
                className="hover:underline"
              >
                @{book.authorUsername ?? 'unknown'}
              </Link>
            </span>
          </div>

          {/* Tag row */}
          <div className="mb-[22px] flex flex-wrap gap-2">
            {book.genre && (
              <span
                className="inline-flex items-center"
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--r-pill)',
                  fontSize: '12px',
                  background: 'var(--canvas-dark-350)',
                  color: 'var(--canvas-dark-ink-strong)',
                  fontWeight: 600,
                  boxShadow: '0 1px 0 0 oklch(1 0 0 / 0.05) inset',
                }}
              >
                {book.genre}
              </span>
            )}
            {book.tags?.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center"
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--r-pill)',
                  fontSize: '12px',
                  background: 'var(--canvas-dark-100)',
                  boxShadow: 'var(--sh-inset)',
                  color: 'var(--canvas-dark-ink-muted)',
                }}
              >
                <span style={{ opacity: 0.5, marginRight: '2px' }}>#</span>
                {tag}
              </span>
            ))}
          </div>

          {/* 4-stat strip */}
          <div
            className="mb-[22px] grid"
            style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}
          >
            {statCells.map(({ label, Icon, node }) => (
              <div
                key={label}
                className="flex flex-col items-center text-center"
                style={{
                  padding: '13px 15px',
                  gap: '5px',
                  borderRadius: 'var(--r-row)',
                  ...tileStyle,
                }}
              >
                <span
                  className="inline-flex items-center"
                  style={{
                    gap: '6px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--brand)',
                  }}
                >
                  <Icon
                    size={13}
                    strokeWidth={1.9}
                    style={{ color: 'var(--brand)', opacity: 0.7 }}
                  />
                  {label}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: '22px',
                    letterSpacing: '-0.02em',
                    color: 'var(--canvas-dark-ink-strong)',
                    lineHeight: 1,
                  }}
                >
                  {node}
                </span>
              </div>
            ))}
          </div>

          {/* Meta line */}
          <p
            className="mb-4"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--canvas-dark-ink-muted)',
              margin: '0 0 16px',
            }}
          >
            Published {fmtDate(firstPublishedAt)}
            <span style={{ margin: '0 8px', color: 'var(--canvas-dark-300)' }}>·</span>
            Updated {fmtDate(lastUpdatedAt)}
          </p>

          {/* Synopsis + Read more */}
          {book.synopsis && (
            <div className="mb-[22px]">
              <p
                ref={synopsisRef}
                style={{
                  fontSize: '15px',
                  lineHeight: 1.6,
                  color: 'var(--canvas-dark-ink)',
                  margin: 0,
                  maxWidth: '60ch',
                  ...(expanded
                    ? {}
                    : {
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical' as 'vertical',
                        overflow: 'hidden',
                      }),
                }}
              >
                {book.synopsis}
              </p>
              {(isTruncated || expanded) && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-2 inline-flex items-center gap-1 text-xs hover:underline"
                  style={{ color: 'var(--brand)', background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}
                >
                  {expanded ? (
                    <>
                      Show less <ChevronUp size={12} />
                    </>
                  ) : (
                    <>
                      Read more <ChevronDown size={12} />
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* CTA row */}
          <div className="flex flex-wrap items-center gap-3">
            {readCta && (
              <Link
                href={readCta}
                className="inline-flex items-center"
                style={{
                  gap: '10px',
                  padding: '12px 22px',
                  borderRadius: 'var(--r-pill)',
                  background: 'var(--brand)',
                  color: 'var(--brand-ink)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: '15px',
                  letterSpacing: '0.005em',
                  textDecoration: 'none',
                  boxShadow:
                    '0 1px 0 0 oklch(1 0 0 / 0.2) inset, 0 4px 10px -6px oklch(0 0 0 / 0.4)',
                  transition: 'background .14s, transform .14s',
                }}
              >
                {readCtaLabel}
                <ArrowRight size={16} strokeWidth={2.4} />
              </Link>
            )}

            <button
              type="button"
              onClick={handleLike}
              aria-pressed={liked}
              aria-label="Favorite"
              className="inline-flex items-center"
              style={{
                gap: '8px',
                height: '44px',
                padding: '0 16px',
                borderRadius: 'var(--r-btn)',
                background: 'linear-gradient(180deg, var(--canvas-dark-300), var(--canvas-dark-250))',
                boxShadow:
                  '0 1px 0 0 oklch(1 0 0 / 0.05) inset, 0 4px 10px -6px oklch(0 0 0 / 0.5)',
                color: 'var(--canvas-dark-ink)',
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                fontWeight: 500,
                border: 0,
                cursor: 'pointer',
              }}
            >
              <Heart
                size={17}
                strokeWidth={1.9}
                style={{
                  fill: liked ? 'var(--brand)' : 'none',
                  stroke: liked ? 'var(--brand)' : 'currentColor',
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  color: liked ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)',
                }}
              >
                {likeCount}
              </span>
            </button>

            <ShareBookDialog
              url={shareUrl}
              visibility={book.visibility}
              trigger={
                <button
                  type="button"
                  aria-label="Share"
                  className="inline-flex items-center"
                  style={{
                    gap: '8px',
                    height: '44px',
                    padding: '0 16px',
                    borderRadius: 'var(--r-btn)',
                    background:
                      'linear-gradient(180deg, var(--canvas-dark-300), var(--canvas-dark-250))',
                    boxShadow:
                      '0 1px 0 0 oklch(1 0 0 / 0.05) inset, 0 4px 10px -6px oklch(0 0 0 / 0.5)',
                    color: 'var(--canvas-dark-ink)',
                    fontFamily: 'var(--font-ui)',
                    fontSize: '14px',
                    fontWeight: 500,
                    border: 0,
                    cursor: 'pointer',
                  }}
                >
                  <Share2 size={17} strokeWidth={1.9} />
                  Share
                </button>
              }
            />

            <button
              type="button"
              onClick={handleBookmark}
              aria-pressed={bookmarked}
              aria-label="Bookmark"
              className="inline-flex items-center justify-center"
              style={{
                width: '44px',
                height: '44px',
                padding: 0,
                borderRadius: 'var(--r-btn)',
                background:
                  'linear-gradient(180deg, var(--canvas-dark-300), var(--canvas-dark-250))',
                boxShadow:
                  '0 1px 0 0 oklch(1 0 0 / 0.05) inset, 0 4px 10px -6px oklch(0 0 0 / 0.5)',
                color: 'var(--canvas-dark-ink)',
                border: 0,
                cursor: 'pointer',
              }}
            >
              <Bookmark
                size={17}
                strokeWidth={1.9}
                style={{
                  fill: bookmarked ? 'var(--brand)' : 'none',
                  stroke: bookmarked ? 'var(--brand)' : 'currentColor',
                }}
              />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
