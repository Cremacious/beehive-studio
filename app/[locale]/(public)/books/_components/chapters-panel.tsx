'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Circle, CheckCircle2 } from 'lucide-react'
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
  const progressPct = totalCount > 0 ? Math.round((readCount / totalCount) * 100) : 0

  const toggle = (binderItemId: string) => {
    if (!isAuthenticated) {
      toast.info('Sign in to track your progress')
      return
    }
    const wasRead = readSet.has(binderItemId)
    const next = new Set(readSet)
    if (wasRead) next.delete(binderItemId)
    else next.add(binderItemId)
    setReadSet(next)
    onReadSetChange?.(next)
    startTransition(async () => {
      const result = wasRead
        ? await unmarkChapterReadAction(bookId, binderItemId)
        : await markChapterReadAction(bookId, binderItemId)
      if (!result.success) {
        setReadSet(readSet)
        onReadSetChange?.(readSet)
        toast.error(wasRead ? "Couldn't unmark" : "Couldn't mark as read")
      }
    })
  }

  return (
    <section
      id="chapters"
      className="scroll-mt-20 rounded-[var(--r-card)] p-6"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
        borderTop: '1px solid var(--br-card)',
      }}
    >
      <div className="mb-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-comfortaa text-lg font-bold text-[var(--brand)]">Chapters</h2>
          {isAuthenticated && totalCount > 0 && (
            <span className="text-xs text-[var(--canvas-dark-ink-muted)]">
              {readCount} / {totalCount} read
            </span>
          )}
        </div>
        {isAuthenticated && totalCount > 0 && (
          <div
            className="mt-2 h-1 overflow-hidden rounded-full"
            style={{ background: 'var(--canvas-dark-100)', boxShadow: 'var(--sh-inset)' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progressPct}%`, background: 'var(--brand)' }}
            />
          </div>
        )}
      </div>

      {visibleChapters.length === 0 ? (
        <p className="text-sm italic text-[var(--canvas-dark-ink-muted)]">No chapters yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {visibleChapters.map((ch, i) => {
            const isRead = readSet.has(ch.binderItemId)
            const isReaderVisible = isAuthor || isChapterReaderVisible(ch.status)
            return (
              <li
                key={ch.chapterId}
                className="flex items-center gap-3 rounded-[var(--r-row)] px-3 py-2.5"
                style={{
                  background:
                    'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                  boxShadow: 'var(--sh-tile)',
                }}
              >
                {isAuthenticated && isReaderVisible ? (
                  <button
                    onClick={() => toggle(ch.binderItemId)}
                    aria-pressed={isRead}
                    aria-label={`Mark "${ch.title}" as ${isRead ? 'unread' : 'read'}`}
                    className="shrink-0"
                  >
                    {isRead ? (
                      <CheckCircle2 className="h-5 w-5 text-[var(--brand)]" />
                    ) : (
                      <Circle className="h-5 w-5 text-[var(--canvas-dark-ink-muted)]" />
                    )}
                  </button>
                ) : (
                  <span className="h-5 w-5 shrink-0" />
                )}
                <span className="w-6 shrink-0 text-xs text-[var(--canvas-dark-ink-muted)]">
                  {i + 1}
                </span>
                {isReaderVisible ? (
                  <Link
                    href={`${readerBasePath}/read/${ch.chapterId}`}
                    className="flex-1 truncate text-sm text-[var(--canvas-dark-ink-strong)] hover:underline"
                  >
                    {ch.title}
                  </Link>
                ) : (
                  <span className="flex-1 truncate text-sm italic text-[var(--canvas-dark-ink-muted)]">
                    {ch.title}
                  </span>
                )}
                {isReaderVisible ? (
                  <span className="shrink-0 text-xs text-[var(--canvas-dark-ink-muted)]">
                    Updated {formatUpdatedLabel(ch.updatedAt)}
                  </span>
                ) : (
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]">
                    Draft — coming soon
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
