import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { ChapterActivityBadges } from './chapter-activity-badges'

type Chapter = {
  id: string
  chapterId: string | null
  title: string
  order: number
  annotationCount: number
  pendingSuggestionCount: number
}

type Props = {
  hiveId: string
  locale: string
  chapters: Chapter[]
  canReview: boolean
}

export function HiveChapterIndex({ hiveId, locale, chapters, canReview }: Props) {
  const base = `/${locale}/hive/${hiveId}`

  if (chapters.length === 0) {
    return (
      <div className="px-6 pb-6">
        <div
          className="p-8 text-center rounded-[var(--r-row)]"
          style={{
            background:
              'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            boxShadow: 'var(--sh-tile)',
            border: 'var(--br-card)',
          }}
        >
          <BookOpen className="w-8 h-8 text-[var(--canvas-dark-ink-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--canvas-dark-ink-strong)] font-medium">
            No chapters yet
          </p>
          <p className="text-xs text-[var(--canvas-dark-ink-muted)] mt-1">
            This is a standalone hive — link a book to get a manuscript.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Column-header strip */}
      <div
        className="grid grid-cols-[40px_1fr_180px] gap-3 px-6 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]"
        style={{
          background: 'var(--canvas-dark-100)',
          borderTop: 'var(--br-card)',
          borderBottom: 'var(--br-card)',
        }}
      >
        <span>#</span>
        <span>Chapter</span>
        <span>Activity</span>
      </div>

      <ul className="divide-y divide-[var(--canvas-dark-300)]/40">
        {chapters.map((chapter, i) => {
          const num = (
            <span className="text-[var(--canvas-dark-ink-muted)] text-sm tabular-nums font-mono">
              {String(i + 1).padStart(2, '0')}
            </span>
          )

          if (!chapter.chapterId) {
            return (
              <li
                key={chapter.id}
                className="grid grid-cols-[40px_1fr_180px] items-center gap-3 px-6 py-3 opacity-60"
              >
                {num}
                <div className="min-w-0">
                  <span className="block font-semibold text-[var(--canvas-dark-ink-strong)] truncate">
                    {chapter.title}
                  </span>
                </div>
                <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]">
                  (no longer accessible)
                </span>
              </li>
            )
          }

          const chapterHref = `${base}/chapters/${chapter.chapterId}`

          return (
            <li
              key={chapter.id}
              className="grid grid-cols-[40px_1fr_180px] items-center gap-3 px-6 py-3 hover:bg-[var(--canvas-dark-300)] transition-colors"
            >
              {num}
              <div className="min-w-0">
                <Link
                  href={chapterHref}
                  className="block font-semibold text-[var(--canvas-dark-ink-strong)] hover:text-[var(--brand)] truncate transition-colors"
                >
                  {chapter.title}
                </Link>
              </div>
              <div className="min-w-0">
                <ChapterActivityBadges
                  annotationCount={chapter.annotationCount}
                  pendingSuggestionCount={chapter.pendingSuggestionCount}
                  canReview={canReview}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
