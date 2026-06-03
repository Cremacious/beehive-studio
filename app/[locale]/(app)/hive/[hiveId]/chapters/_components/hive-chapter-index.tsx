import Link from 'next/link'
import { BookOpen, ChevronRight } from 'lucide-react'
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

const PANEL_STYLE = {
  background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
  borderRadius: 'var(--r-card)',
  boxShadow: 'var(--sh-card)',
  border: 'var(--br-card)',
} as const

const ROW_STYLE = {
  background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
  borderRadius: 'var(--r-row)',
  boxShadow: 'var(--sh-tile)',
  border: 'var(--br-card)',
} as const

export function HiveChapterIndex({ hiveId, locale, chapters, canReview }: Props) {
  const base = `/${locale}/hive/${hiveId}`

  if (chapters.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <div style={PANEL_STYLE} className="p-6">
          <h1
            style={{ color: 'var(--brand)' }}
            className="font-comfortaa font-bold text-2xl mb-6"
          >
            Chapters
          </h1>
          <div
            style={ROW_STYLE}
            className="p-8 text-center"
          >
            <BookOpen className="w-8 h-8 text-[var(--canvas-dark-ink-muted)] mx-auto mb-3" />
            <p className="text-sm text-[var(--canvas-dark-ink-strong)] font-medium">No chapters yet</p>
            <p className="text-xs text-[var(--canvas-dark-ink-muted)] mt-1">
              This is a standalone hive — link a book to get a manuscript.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div style={PANEL_STYLE} className="p-6">
        <div className="mb-6 flex items-baseline gap-3">
          <h1
            style={{ color: 'var(--brand)' }}
            className="font-comfortaa font-bold text-2xl"
          >
            Chapters
          </h1>
          <span className="text-xs font-mono text-[var(--canvas-dark-ink-muted)]">
            {chapters.length}
          </span>
        </div>

        <ul className="flex flex-col gap-2">
          {chapters.map((chapter, i) => {
            const num = (
              <span className="text-xs font-mono text-[var(--canvas-dark-ink-muted)] w-8 flex-shrink-0">
                {String(i + 1).padStart(2, '0')}
              </span>
            )
            const titleBlock = (
              <div className="flex-1 min-w-0">
                <span className="block font-comfortaa font-semibold text-sm text-[var(--canvas-dark-ink-strong)] truncate">
                  {chapter.title}
                </span>
                <ChapterActivityBadges
                  annotationCount={chapter.annotationCount}
                  pendingSuggestionCount={chapter.pendingSuggestionCount}
                  canReview={canReview}
                />
              </div>
            )
            // chapterId is null for binder-item rows that have no backing chapters
            // row (shouldn't happen for type='chapter' under normal conditions,
            // but defensive). Render as a disabled row in that case.
            if (!chapter.chapterId) {
              return (
                <li
                  key={chapter.id}
                  style={ROW_STYLE}
                  className="flex items-center gap-3 px-4 py-3 opacity-60"
                >
                  {num}
                  {titleBlock}
                  <span className="text-xs text-[var(--canvas-dark-ink-muted)] italic flex-shrink-0">
                    Unavailable
                  </span>
                </li>
              )
            }
            return (
              <li key={chapter.id}>
                <Link
                  href={`${base}/chapters/${chapter.chapterId}`}
                  style={ROW_STYLE}
                  className="flex items-center gap-3 px-4 py-3 hover:translate-y-[-1px] transition-transform group"
                >
                  {num}
                  {titleBlock}
                  <ChevronRight className="w-4 h-4 text-[var(--canvas-dark-ink-muted)] group-hover:text-[var(--brand)] transition-colors flex-shrink-0" />
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
