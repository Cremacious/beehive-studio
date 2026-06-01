import Link from 'next/link'
import { BookOpen, ChevronRight } from 'lucide-react'

type Chapter = { id: string; chapterId: string | null; title: string; order: number }

type Props = {
  hiveId: string
  locale: string
  chapters: Chapter[]
}

export function HiveChapterIndex({ hiveId, locale, chapters }: Props) {
  const base = `/${locale}/hive/${hiveId}`

  if (chapters.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <div className="mb-6">
          <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground mb-2">Hive</p>
          <h1 className="text-2xl font-medium text-foreground">Chapters</h1>
        </div>
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-foreground font-medium">No chapters yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            This is a standalone hive — link a book to get a manuscript.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="mb-6 flex items-baseline gap-3">
        <div>
          <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground mb-2">Hive</p>
          <h1 className="text-2xl font-medium text-foreground">Chapters</h1>
        </div>
        <span className="text-xs font-mono text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
          {chapters.length}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {chapters.map((chapter, i) => {
          const num = (
            <span className="text-xs font-mono text-muted-foreground w-8 flex-shrink-0">
              {String(i + 1).padStart(2, '0')}
            </span>
          )
          const title = (
            <span className="flex-1 text-sm text-foreground truncate">{chapter.title}</span>
          )
          // chapterId is null for binder-item rows that have no backing chapters
          // row (shouldn't happen for type='chapter' under normal conditions,
          // but defensive). Render as a disabled row in that case.
          if (!chapter.chapterId) {
            return (
              <li key={chapter.id} className="flex items-center gap-3 bg-card border border-border rounded-lg p-4 opacity-60">
                {num}
                {title}
                <span className="text-xs text-muted-foreground italic flex-shrink-0">Unavailable</span>
              </li>
            )
          }
          return (
            <li key={chapter.id}>
              <Link
                href={`${base}/chapters/${chapter.chapterId}`}
                className="flex items-center gap-3 bg-card border border-border rounded-lg p-4 hover:border-brand transition-colors group"
              >
                {num}
                {title}
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-brand transition-colors flex-shrink-0" />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
