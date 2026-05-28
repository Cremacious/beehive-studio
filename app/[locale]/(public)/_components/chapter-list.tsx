'use client'

import { useState } from 'react'
import Link from 'next/link'

type ChapterItem = {
  binderItemId: string
  chapterId: string
  title: string
  wordCount: number
  order: number
}

type Props = {
  bookId: string
  locale: string
  chapters: ChapterItem[]
  currentChapterId: string | null
  readChapterBinderItemIds: string[]
}

export function ChapterList({ bookId, locale, chapters, currentChapterId, readChapterBinderItemIds }: Props) {
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

          return (
            <Link
              key={ch.chapterId}
              href={`/${locale}/discover/book/${bookId}/read/${ch.chapterId}`}
              className={`flex items-center gap-3 px-2.5 py-2 rounded-md text-[13px] transition-colors ${
                isCurrent ? 'bg-[#1e1e1e]' : 'hover:bg-[#1a1a1a]'
              }`}
            >
              <span className="text-[#555] text-[11px] w-5 shrink-0">{i + 1}</span>
              <span className="text-[#aaa] flex-1 truncate">{ch.title}</span>
              <span className="text-[#555] text-[11px] shrink-0">
                {ch.wordCount >= 1000 ? `${Math.round(ch.wordCount / 1000)}k` : ch.wordCount}w
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
