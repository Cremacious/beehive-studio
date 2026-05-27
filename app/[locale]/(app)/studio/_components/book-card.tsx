import Link from 'next/link'
import { BookMarked, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BookSummary } from '@/lib/actions/book.actions'

type Props = {
  book: BookSummary
  locale: string
}

function statusColor(status: BookSummary['status']): string {
  switch (status) {
    case 'Published': return 'var(--status-final)'
    case 'Revised':   return 'var(--status-revised)'
    case 'Drafting':  return 'var(--status-first-draft)'
  }
}

function formatRelative(d: Date): string {
  const diff = Date.now() - new Date(d).getTime()
  const days = Math.floor(diff / 86400_000)
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export function BookCard({ book, locale }: Props) {
  return (
    <Link
      href={`/${locale}/studio/${book.id}`}
      className="group relative flex flex-col rounded-xl border border-border bg-card overflow-hidden hover:border-brand/30 transition-colors"
    >
      {/* Cover — paper-warm placeholder */}
      <div className="relative aspect-[2/3] overflow-hidden">
        {book.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: 'var(--paper-100)', color: 'var(--paper-ink-strong)' }}
          >
            <BookMarked size={32} className="opacity-40" />
          </div>
        )}

        {/* Hover overlay — dashboard data */}
        <div
          className="absolute inset-0 flex flex-col justify-end gap-2 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{
            background: 'linear-gradient(to top, oklch(0 0 0 / 0.85) 0%, oklch(0 0 0 / 0.7) 50%, oklch(0 0 0 / 0) 100%)',
          }}
        >
          <div className="flex items-center gap-1.5 text-[11px] text-white">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{
                background: 'oklch(from ' + statusColor(book.status) + ' l c h / 0.25)',
                color: statusColor(book.status),
                border: `1px solid ${statusColor(book.status)}40`,
              }}
            >
              {book.status}
            </span>
            {book.genre && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-white/15 text-white/90">
                {book.genre}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-white/85">
            <Clock size={11} />
            <span>{formatRelative(book.lastEditedAt)}</span>
            <span className="text-white/50">·</span>
            <span>{book.chapterCount} {book.chapterCount === 1 ? 'chapter' : 'chapters'}</span>
          </div>
        </div>
      </div>

      {/* Info — visible at rest */}
      <div className="p-3 flex flex-col gap-0.5">
        <p className={cn(
          'text-sm font-medium text-foreground truncate transition-colors',
          'group-hover:text-brand',
        )}>
          {book.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {book.wordCount.toLocaleString()} words
        </p>
      </div>
    </Link>
  )
}
