'use client'

import { useState } from 'react'
import Link from 'next/link'
import { isChapterReaderVisible, type ChapterStatus } from '@/lib/books/is-chapter-reader-visible'

type ChapterItem = {
  binderItemId: string
  chapterId: string
  title: string
  wordCount: number
  order: number
  status: ChapterStatus
  updatedAt: Date | string
}

type Props = {
  bookId: string
  locale: string
  readerBasePath: string
  chapters: ChapterItem[]
  currentChapterId: string | null
  readChapterBinderItemIds: string[]
  isAuthor: boolean
}

function formatUpdatedLabel(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ChapterList({ readerBasePath, chapters, currentChapterId, readChapterBinderItemIds, isAuthor }: Props) {
  const [expanded, setExpanded] = useState(false)
  const visibleChapters = expanded ? chapters : chapters.slice(0, 5)
  const remaining = chapters.length - 5

  return (
    <div>
      <p className="text-[#666] text-[11px] uppercase tracking-widest mb-3">Chapters</p>
      <div className="flex flex-col gap-0.5">
        {visibleChapters.map((ch, i) => {
          const isRead = readChapterBinderItemIds.includes(ch.binderItemId)
          const isCurrent = currentChapterId === ch.chapterId
          const isVisible = isAuthor || isChapterReaderVisible(ch.status)

          if (!isVisible) {
            return (
              <div
                key={ch.chapterId}
                className="flex items-center gap-3 px-2.5 py-2 rounded-md text-[13px] cursor-not-allowed opacity-70"
                aria-disabled="true"
              >
                <span className="text-[#555] text-[11px] w-5 shrink-0">{i + 1}</span>
                <span className="text-[#666] flex-1 truncate italic">{ch.title}</span>
                <span className="text-[#888] text-[10px] shrink-0 uppercase tracking-wider">
                  Draft — coming soon
                </span>
              </div>
            )
          }

          const updatedLabel = formatUpdatedLabel(ch.updatedAt)

          return (
            <Link
              key={ch.chapterId}
              href={`${readerBasePath}/read/${ch.chapterId}`}
              className={`flex items-center gap-3 px-2.5 py-2 rounded-md text-[13px] transition-colors ${
                isCurrent ? 'bg-[#1e1e1e]' : 'hover:bg-[#1a1a1a]'
              }`}
            >
              <span className="text-[#555] text-[11px] w-5 shrink-0">{i + 1}</span>
              <span className="text-[#aaa] flex-1 truncate">{ch.title}</span>
              <span className="text-[#555] text-[11px] shrink-0">
                {ch.wordCount >= 1000 ? `${Math.round(ch.wordCount / 1000)}k` : ch.wordCount}w
              </span>
              <span className="text-[#555] text-[10px] shrink-0 hidden sm:inline">
                Updated {updatedLabel}
              </span>
              {isRead && <span className="text-[#FFC300] text-[10px] shrink-0">✓ Read</span>}
              {isCurrent && !isRead && <span className="text-[#888] text-[10px] shrink-0">Reading</span>}
            </Link>
          )
        })}
        {!expanded && remaining > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="text-[#555] text-[12px] py-2 text-center hover:text-[#888] transition-colors cursor-pointer"
          >
            + {remaining} more chapter{remaining !== 1 ? 's' : ''}
          </button>
        )}
      </div>
    </div>
  )
}
