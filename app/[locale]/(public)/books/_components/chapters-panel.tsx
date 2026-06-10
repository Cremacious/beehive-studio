'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Circle, CheckCircle2, Lock } from 'lucide-react'
import { toast } from 'sonner'
import {
  markChapterReadAction,
  unmarkChapterReadAction,
} from '@/lib/actions/reading.actions'
import {
  isChapterReaderVisible,
  type ChapterStatus,
} from '@/lib/books/is-chapter-reader-visible'

type ChapterItem = {
  binderItemId: string
  chapterId: string
  title: string
  order: number
  status: ChapterStatus
  updatedAt: Date | string
}

type Props = {
  bookId: string
  readerBasePath: string
  chapters: ChapterItem[]
  initialReadSet: string[]
  isAuthor: boolean
  isAuthenticated: boolean
  onReadSetChange?: (next: Set<string>) => void
}

function formatUpdatedLabel(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export function ChaptersPanel({
  bookId,
  readerBasePath,
  chapters,
  initialReadSet,
  isAuthor,
  isAuthenticated,
  onReadSetChange,
}: Props) {
  const [readSet, setReadSet] = useState<Set<string>>(() => new Set(initialReadSet))
  const [, startTransition] = useTransition()

  const visibleChapters = isAuthor
    ? chapters
    : chapters.filter((c) => isChapterReaderVisible(c.status))

  const totalCount = visibleChapters.length
  const readCount = visibleChapters.filter((c) => readSet.has(c.binderItemId)).length

  const toggle = (binderItemId: string) => {
    if (!isAuthenticated) {
      toast.info('Sign in to track your progress')
      return
    }
    const wasRead = readSet.has(binderItemId)
    setReadSet((prev) => {
      const next = new Set(prev)
      if (wasRead) next.delete(binderItemId)
      else next.add(binderItemId)
      onReadSetChange?.(next)
      return next
    })
    startTransition(async () => {
      const result = wasRead
        ? await unmarkChapterReadAction(bookId, binderItemId)
        : await markChapterReadAction(bookId, binderItemId)
      if (!result.success) {
        setReadSet((prev) => {
          const reverted = new Set(prev)
          if (wasRead) reverted.add(binderItemId)
          else reverted.delete(binderItemId)
          onReadSetChange?.(reverted)
          return reverted
        })
        toast.error(wasRead ? "Couldn't unmark" : "Couldn't mark as read")
      }
    })
  }

  return (
    <section
      id="chapters"
      className="scroll-mt-20 rounded-[var(--r-card)]"
      style={{
        padding: '30px 32px 32px',
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
        borderTop: '1px solid var(--br-card)',
      }}
    >
      {/* section head */}
      <div className="mb-[22px] flex items-baseline justify-between gap-4">
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '22px',
            letterSpacing: '-0.01em',
            color: 'var(--brand)',
            margin: 0,
          }}
        >
          Chapters
        </h2>
        {isAuthenticated && totalCount > 0 && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              letterSpacing: '0.08em',
              color: 'var(--canvas-dark-ink-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            <b style={{ color: 'var(--canvas-dark-ink-strong)', fontWeight: 500 }}>{readCount}</b>
            {' / '}
            {totalCount} read
          </span>
        )}
      </div>

      {/* Segmented progress rail */}
      {isAuthenticated && totalCount > 0 && (
        <div className="mb-[26px]">
          <div
            role="progressbar"
            aria-valuenow={readCount}
            aria-valuemin={0}
            aria-valuemax={totalCount}
            aria-label="Reading progress"
            className="flex"
            style={{
              gap: '4px',
              padding: '6px',
              borderRadius: 'var(--r-pill)',
              background: 'var(--canvas-dark-100)',
              boxShadow: 'var(--sh-inset)',
            }}
          >
            {visibleChapters.map((ch) => {
              const filled = readSet.has(ch.binderItemId)
              return (
                <span
                  key={ch.binderItemId}
                  style={{
                    flex: 1,
                    height: '8px',
                    borderRadius: 'var(--r-pill)',
                    background: filled ? 'var(--brand)' : 'var(--canvas-dark-300)',
                    boxShadow: filled
                      ? '0 0 8px -2px oklch(0.8 0.16 88 / 0.6)'
                      : undefined,
                    transition: 'background .2s',
                  }}
                />
              )
            })}
          </div>
        </div>
      )}

      {visibleChapters.length === 0 ? (
        <p
          className="text-center italic"
          style={{
            color: 'var(--canvas-dark-ink-muted)',
            padding: '32px 0',
            margin: 0,
          }}
        >
          No chapters yet.
        </p>
      ) : (
        <ul className="flex flex-col" style={{ gap: '8px' }}>
          {visibleChapters.map((ch, i) => {
            const isRead = readSet.has(ch.binderItemId)
            const isReaderVisible = isAuthor || isChapterReaderVisible(ch.status)

            if (!isReaderVisible) {
              return (
                <li
                  key={ch.chapterId}
                  className="flex items-center"
                  style={{
                    gap: '16px',
                    padding: '14px 18px',
                    borderRadius: 'var(--r-row)',
                    background: 'var(--canvas-dark-150)',
                    border: '1px dashed var(--canvas-dark-300)',
                  }}
                >
                  <span
                    aria-hidden
                    className="inline-flex flex-shrink-0 items-center justify-center"
                    style={{
                      width: '26px',
                      color: 'var(--canvas-dark-ink-faint)',
                    }}
                  >
                    <Lock size={17} strokeWidth={1.9} />
                  </span>
                  <span
                    style={{
                      flexShrink: 0,
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      color: 'var(--canvas-dark-ink-muted)',
                      width: '22px',
                      textAlign: 'center',
                    }}
                  >
                    {pad2(i + 1)}
                  </span>
                  <span
                    className="flex-1 truncate"
                    style={{
                      fontStyle: 'italic',
                      fontWeight: 400,
                      color: 'var(--canvas-dark-ink-muted)',
                      fontSize: '15px',
                    }}
                  >
                    {ch.title}
                  </span>
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: '13px',
                      color: 'var(--canvas-dark-ink-faint)',
                    }}
                  >
                    Draft, coming soon
                  </span>
                </li>
              )
            }

            return (
              <li key={ch.chapterId}>
                <Link
                  href={`${readerBasePath}/read/${ch.chapterId}`}
                  className="group flex items-center no-underline"
                  style={{
                    gap: '16px',
                    padding: '14px 18px',
                    borderRadius: 'var(--r-row)',
                    background:
                      'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                    boxShadow: 'var(--sh-tile)',
                    color: 'inherit',
                    transition: 'transform .14s, box-shadow .14s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow =
                      '0 1px 0 0 oklch(1 0 0 / 0.07) inset, 0 12px 22px -10px oklch(0 0 0 / 0.5)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = ''
                    e.currentTarget.style.boxShadow = 'var(--sh-tile)'
                  }}
                >
                  {isAuthenticated ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        toggle(ch.binderItemId)
                      }}
                      aria-pressed={isRead}
                      aria-label={`Mark "${ch.title}" as ${isRead ? 'unread' : 'read'}`}
                      className="inline-flex items-center justify-center"
                      style={{
                        flexShrink: 0,
                        width: '26px',
                        height: '26px',
                        border: 0,
                        padding: 0,
                        background: 'transparent',
                        cursor: 'pointer',
                        color: isRead
                          ? 'var(--brand)'
                          : 'var(--canvas-dark-ink-faint)',
                      }}
                    >
                      {isRead ? (
                        <CheckCircle2 size={22} strokeWidth={1.9} />
                      ) : (
                        <Circle size={22} strokeWidth={1.9} />
                      )}
                    </button>
                  ) : (
                    <span style={{ width: '26px', height: '26px', flexShrink: 0 }} />
                  )}
                  <span
                    style={{
                      flexShrink: 0,
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      color: 'var(--canvas-dark-ink-muted)',
                      width: '22px',
                      textAlign: 'center',
                    }}
                  >
                    {pad2(i + 1)}
                  </span>
                  <span
                    className="flex-1 truncate"
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '15px',
                      fontWeight: 500,
                      color: isRead
                        ? 'var(--canvas-dark-ink)'
                        : 'var(--canvas-dark-ink-strong)',
                    }}
                  >
                    {ch.title}
                  </span>
                  <span
                    style={{
                      flexShrink: 0,
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      letterSpacing: '0.04em',
                      color: 'var(--canvas-dark-ink-muted)',
                    }}
                  >
                    Updated {formatUpdatedLabel(ch.updatedAt)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
