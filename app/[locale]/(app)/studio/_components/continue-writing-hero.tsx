import Link from 'next/link'
import { BookMarked } from 'lucide-react'
import type { BookSummary } from '@/lib/actions/book.actions'

type Props = {
  book: BookSummary
  locale: string
}

export function ContinueWritingHero({ book, locale }: Props) {
  return (
    <Link
      href={`/${locale}/studio/${book.id}`}
      className="group relative flex gap-4 rounded-xl border border-border bg-card p-4 hover:border-brand/30 transition-colors"
    >
      {/* Cover thumbnail */}
      <div className="relative w-20 h-28 shrink-0 overflow-hidden rounded-md">
        {book.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: 'var(--paper-100)', color: 'var(--paper-ink-strong)' }}
          >
            <BookMarked size={20} className="opacity-40" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Continue writing
        </span>
        <h2
          className="text-xl font-bold text-foreground truncate group-hover:text-brand transition-colors"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {book.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {book.wordCount.toLocaleString()} words · {book.chapterCount} {book.chapterCount === 1 ? 'chapter' : 'chapters'}
        </p>
        <div className="mt-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand text-brand-ink text-xs font-bold mainFont group-hover:bg-brand-hover transition-colors">
            Resume writing →
          </span>
        </div>
      </div>
    </Link>
  )
}
