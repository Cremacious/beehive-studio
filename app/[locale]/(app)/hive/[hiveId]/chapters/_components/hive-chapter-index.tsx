import Link from 'next/link'
import { BookOpen, ChevronRight } from 'lucide-react'
import { relTime } from '@/components/hive/collab/rel-time'

type Chapter = {
  id: string
  chapterId: string | null
  title: string
  order: number
  updatedAt: Date
  collectionId: string | null
  collectionTitle: string | null
}

type Props = {
  hiveId: string
  locale: string
  chapters: Chapter[]
  /** Render the mobile reading-list cards (issue #50) instead of the table. */
  mobile?: boolean
}

export function HiveChapterIndex({ hiveId, locale, chapters, mobile }: Props) {
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
            This is a standalone hive. Link a book to get a manuscript.
          </p>
        </div>
      </div>
    )
  }

  // ── Mobile (issue #50, variant C — reading list) ──
  if (mobile) {
    return (
      <div className="flex flex-col gap-2.5 pb-6">
        {chapters.map((chapter, i) => {
          const accessible = !!chapter.chapterId
          const cardStyle = {
            background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            boxShadow: 'var(--sh-tile)',
            borderRadius: 'var(--r-card)',
          } as const
          const badge = (
            <span
              className="shrink-0 inline-flex items-center justify-center font-comfortaa font-medium"
              style={{ width: 38, height: 38, borderRadius: 10, background: 'oklch(from var(--brand) l c h / 0.12)', color: 'var(--brand)', fontSize: 16 }}
            >
              {i + 1}
            </span>
          )
          const body = (
            <div className="flex-1 min-w-0">
              {chapter.collectionTitle && (
                <span className="block font-mono text-[10px] uppercase tracking-wider truncate" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                  {chapter.collectionTitle}
                </span>
              )}
              <span className="block font-medium text-[15px] leading-snug" style={{ color: 'var(--canvas-dark-ink-strong)' }}>
                {chapter.title}
              </span>
              <span className="block font-mono text-[10px] mt-1" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                {accessible ? `edited ${relTime(chapter.updatedAt)}` : 'no longer accessible'}
              </span>
            </div>
          )
          return accessible ? (
            <Link
              key={chapter.id}
              href={`${base}/chapters/${chapter.chapterId}`}
              className="flex items-center gap-3 p-3.5 no-underline"
              style={cardStyle}
            >
              {badge}
              {body}
              <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--canvas-dark-ink-muted)' }} />
            </Link>
          ) : (
            <div key={chapter.id} className="flex items-center gap-3 p-3.5 opacity-60" style={cardStyle}>
              {badge}
              {body}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      {/* Column-header strip */}
      <div
        className="grid grid-cols-[40px_1fr_180px] gap-3 px-5 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] max-md:hidden"
        style={{
          background: 'var(--canvas-dark-100)',
          borderTop: 'var(--br-card)',
          borderBottom: 'var(--br-card)',
        }}
      >
        <span>#</span>
        <span>Chapter</span>
        <span className="text-right">Last edit</span>
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
                className="grid grid-cols-[40px_1fr_180px] max-md:grid-cols-[36px_1fr] items-center gap-3 px-5 py-3 opacity-60"
              >
                {num}
                <div className="min-w-0">
                  <span className="block font-medium text-[15px] text-[var(--canvas-dark-ink-strong)] truncate">
                    {chapter.title}
                  </span>
                </div>
                <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] text-right max-md:hidden">
                  (no longer accessible)
                </span>
              </li>
            )
          }

          const chapterHref = `${base}/chapters/${chapter.chapterId}`

          return (
            <li key={chapter.id} className="group">
              <Link
                href={chapterHref}
                className="grid grid-cols-[40px_1fr_180px] max-md:grid-cols-[36px_1fr] items-center gap-3 px-5 py-3 hover:bg-[var(--canvas-dark-300)] transition-colors no-underline"
              >
                {num}
                <div className="min-w-0">
                  {chapter.collectionTitle && (
                    <span
                      className="block font-mono text-[10px] uppercase tracking-wider truncate"
                      style={{ color: 'var(--canvas-dark-ink-muted)' }}
                    >
                      {chapter.collectionTitle}
                    </span>
                  )}
                  <span className="block font-medium text-[15px] text-[var(--canvas-dark-ink-strong)] group-hover:text-[var(--brand)] truncate transition-colors">
                    {chapter.title}
                  </span>
                </div>
                <span className="font-mono text-[11px] tracking-wider text-[var(--canvas-dark-ink-muted)] text-right max-md:hidden">
                  {relTime(chapter.updatedAt)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
