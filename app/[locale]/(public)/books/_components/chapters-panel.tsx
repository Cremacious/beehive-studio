'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Circle, CheckCircle2, ChevronDown, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { toastActionError, toastNetworkError } from '@/lib/errors/notify'
import {
  markChapterReadAction,
  unmarkChapterReadAction,
} from '@/lib/actions/reading.actions'
import {
  isChapterReaderVisible,
  type ChapterStatus,
} from '@/lib/books/is-chapter-reader-visible'
import type { ReadingChapter, ReadingNode } from '@/lib/books/build-reading-order'
import { fbmSubtypeLabel } from './front-back-matter-display'

type ChapterItem = {
  binderItemId: string
  chapterId: string
  title: string
  status: ChapterStatus
  updatedAt: Date | string
  collectionId: string | null
}

export type FbmListItem = {
  chapterId: string
  title: string
  subtype: string | null
}

type Props = {
  bookId: string
  readerBasePath: string
  // Flat reading-order list of all chapters in the book. Used for read
  // tracking, progress bar segments, and totals.
  chapters: ChapterItem[]
  // Structured tree of top-level nodes. Collections render as collapsible
  // cards with their children indented inside. Chapter nodes render as
  // regular rows.
  tree: ReadingNode[]
  // Front + back matter items (already visibility-filtered by the page).
  // Rendered as small linked rows in their own sections above and below
  // the chapter list, not counted toward progress.
  frontMatter: FbmListItem[]
  backMatter: FbmListItem[]
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
  tree,
  frontMatter,
  backMatter,
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
    const revert = () => {
      setReadSet((prev) => {
        const reverted = new Set(prev)
        if (wasRead) reverted.add(binderItemId)
        else reverted.delete(binderItemId)
        onReadSetChange?.(reverted)
        return reverted
      })
    }
    startTransition(async () => {
      try {
        const result = wasRead
          ? await unmarkChapterReadAction(bookId, binderItemId)
          : await markChapterReadAction(bookId, binderItemId)
        if (!result.success) {
          revert()
          toastActionError(result.error)
        }
      } catch {
        revert()
        toastNetworkError()
      }
    })
  }

  // Walk the visible reading order once and assign a running 1-based index
  // to every reader-visible chapter. The number rendered next to each row
  // is this index, so numbering stays continuous across collections.
  const displayIndexByChapterId = new Map<string, number>()
  let runningIndex = 0
  for (const ch of visibleChapters) {
    const isReaderVisible = isAuthor || isChapterReaderVisible(ch.status)
    if (isReaderVisible) {
      runningIndex += 1
      displayIndexByChapterId.set(ch.chapterId, runningIndex)
    }
  }

  // Filter the tree's collections: a collection with zero visible chapters
  // (e.g. non-author viewer + all drafts) is hidden so the reader doesn't
  // see an empty section header.
  const visibleTree: ReadingNode[] = []
  for (const node of tree) {
    if (node.kind === 'chapter') {
      if (isAuthor || isChapterReaderVisible(node.chapter.status)) {
        visibleTree.push(node)
      }
      continue
    }
    const visibleKids = node.children.filter((c) =>
      isAuthor ? true : isChapterReaderVisible(c.status),
    )
    if (visibleKids.length === 0) continue
    visibleTree.push({ ...node, children: visibleKids })
  }

  const renderRow = (ch: ReadingChapter, displayIndex: number) => {
    const isRead = readSet.has(ch.binderItemId)
    const isReaderVisible = isAuthor || isChapterReaderVisible(ch.status)

    if (!isReaderVisible) {
      return (
        <li
          key={ch.chapterId}
          className="ch-row flex items-center"
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
            className="ch-check inline-flex flex-shrink-0 items-center justify-center"
            style={{ width: '26px', color: 'var(--canvas-dark-ink-faint)' }}
          >
            <Lock size={17} strokeWidth={1.9} />
          </span>
          <span
            className="ch-num"
            style={{
              flexShrink: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--canvas-dark-ink-muted)',
              width: '22px',
              textAlign: 'center',
            }}
          >
            {pad2(displayIndex)}
          </span>
          <span
            className="ch-title flex-1 truncate"
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
            className="ch-date"
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
          className="ch-row group flex items-center no-underline"
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
              className="ch-check inline-flex items-center justify-center"
              style={{
                flexShrink: 0,
                width: '26px',
                height: '26px',
                border: 0,
                padding: 0,
                background: 'transparent',
                cursor: 'pointer',
                color: isRead ? 'var(--brand)' : 'var(--canvas-dark-ink-faint)',
              }}
            >
              {isRead ? (
                <CheckCircle2 size={22} strokeWidth={1.9} />
              ) : (
                <Circle size={22} strokeWidth={1.9} />
              )}
            </button>
          ) : (
            <span className="ch-check" style={{ width: '26px', height: '26px', flexShrink: 0 }} />
          )}
          <span
            className="ch-num"
            style={{
              flexShrink: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--canvas-dark-ink-muted)',
              width: '22px',
              textAlign: 'center',
            }}
          >
            {pad2(displayIndex)}
          </span>
          <span
            className="ch-title flex-1 truncate"
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
            className="ch-date"
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
  }

  return (
    <section
      id="chapters"
      className="chapters-panel scroll-mt-20 rounded-[var(--r-card)]"
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

      {frontMatter.length > 0 && (
        <FbmList
          label="Front matter"
          items={frontMatter}
          readerBasePath={readerBasePath}
        />
      )}

      {totalCount === 0 ? (
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
          {visibleTree.map((node) => {
            if (node.kind === 'chapter') {
              const idx = displayIndexByChapterId.get(node.chapter.chapterId) ?? 0
              return renderRow(node.chapter, idx)
            }
            return (
              <CollectionRow
                key={node.binderItemId}
                bookId={bookId}
                collectionId={node.binderItemId}
                title={node.title}
                childCount={node.children.length}
              >
                {node.children.map((c) => {
                  const idx = displayIndexByChapterId.get(c.chapterId) ?? 0
                  return renderRow(c, idx)
                })}
              </CollectionRow>
            )
          })}
        </ul>
      )}

      {backMatter.length > 0 && (
        <FbmList
          label="Back matter"
          items={backMatter}
          readerBasePath={readerBasePath}
        />
      )}
    </section>
  )
}

function FbmList({
  label,
  items,
  readerBasePath,
}: {
  label: string
  items: FbmListItem[]
  readerBasePath: string
}) {
  return (
    <div style={{ margin: label === 'Front matter' ? '0 0 22px' : '22px 0 0' }}>
      <h3
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--canvas-dark-ink-muted)',
          margin: '0 0 10px',
        }}
      >
        {label}
      </h3>
      <ul className="flex flex-col" style={{ gap: '4px' }}>
        {items.map((item) => {
          const sublabel = fbmSubtypeLabel(
            item.subtype,
            label === 'Front matter' ? 'front_matter' : 'back_matter',
          )
          return (
            <li key={item.chapterId}>
              <Link
                href={`${readerBasePath}/read/${item.chapterId}`}
                className="group flex items-center no-underline"
                style={{
                  gap: '12px',
                  padding: '10px 16px',
                  borderRadius: 'var(--r-row)',
                  background: 'var(--canvas-dark-150)',
                  color: 'inherit',
                  transition: 'transform .14s, background .14s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.background =
                    'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = ''
                  e.currentTarget.style.background = 'var(--canvas-dark-150)'
                }}
              >
                <span
                  className="flex-1 truncate"
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--canvas-dark-ink-strong)',
                  }}
                >
                  {item.title}
                </span>
                <span
                  style={{
                    flexShrink: 0,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--canvas-dark-ink-muted)',
                  }}
                >
                  {sublabel}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function CollectionRow({
  bookId,
  collectionId,
  title,
  childCount,
  children,
}: {
  bookId: string
  collectionId: string
  title: string
  childCount: number
  children: React.ReactNode
}) {
  const storageKey = `book:${bookId}:collections-closed`
  const [open, setOpen] = useState<boolean>(true)
  const [hydrated, setHydrated] = useState(false)

  // On mount, read localStorage. Persist CLOSED ids (default open), so
  // unknown collections stay open by default.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      const closed: string[] = raw ? JSON.parse(raw) : []
      if (Array.isArray(closed) && closed.includes(collectionId)) {
        setOpen(false)
      }
    } catch {
      // ignore
    }
    setHydrated(true)
  }, [storageKey, collectionId])

  useEffect(() => {
    if (!hydrated) return
    try {
      const raw = localStorage.getItem(storageKey)
      const closed: string[] = raw ? JSON.parse(raw) : []
      const next = open
        ? closed.filter((id) => id !== collectionId)
        : Array.from(new Set([...closed, collectionId]))
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      // ignore
    }
  }, [open, hydrated, storageKey, collectionId])

  return (
    <li>
      <div
        style={{
          borderRadius: 'var(--r-row)',
          background:
            'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          border: '1px solid var(--canvas-dark-300)',
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`}
          className="flex w-full items-center text-left"
          style={{
            gap: '12px',
            padding: '14px 18px',
            background: 'transparent',
            border: 0,
            cursor: 'pointer',
            color: 'inherit',
          }}
        >
          <ChevronDown
            size={16}
            strokeWidth={2}
            style={{
              flexShrink: 0,
              color: 'var(--brand)',
              transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform .18s',
            }}
          />
          <span
            className="flex-1 truncate"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '15px',
              color: 'var(--canvas-dark-ink-strong)',
              letterSpacing: '-0.005em',
            }}
          >
            {title}
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
            {childCount} {childCount === 1 ? 'chapter' : 'chapters'}
          </span>
        </button>
        {open && (
          <ul
            className="flex flex-col"
            style={{
              gap: '6px',
              padding: '4px 12px 14px 28px',
            }}
          >
            {children}
          </ul>
        )}
      </div>
    </li>
  )
}
