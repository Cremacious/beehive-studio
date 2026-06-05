import Link from 'next/link'
import type { ListBookRow } from '@/lib/actions/reading-lists.actions'
import type { DerivedBookRow } from '@/lib/reading-lists/liked-list-books'

type Props = {
  book: ListBookRow | DerivedBookRow
  isOwner: boolean
  locale: string
}

/**
 * T10 stub. T13 will enrich with: thumbnail (cover_url or fallback),
 * isRead checkbox, 5-star rating display + click-to-edit, commentary
 * excerpt + Show more toggle, ⋯ kebab (Edit Metadata / Remove).
 */
export function BookRow({ book, isOwner, locale }: Props) {
  void isOwner
  const innerStyle = {
    background:
      'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    boxShadow: 'var(--sh-tile)',
  } as const

  const content = (
    <div className="flex items-center gap-3">
      <div>
        <h4 className="font-semibold text-sm text-[var(--canvas-dark-ink-strong)]">
          {book.title}
        </h4>
        <p className="text-xs text-[var(--canvas-dark-ink-muted)]">
          by {book.author}
        </p>
        {book.isRead && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--brand)] mt-1 inline-block">
            Read
          </span>
        )}
      </div>
    </div>
  )

  if (book.bookId) {
    return (
      <Link
        href={`/${locale}/books/${book.bookId}`}
        className="block p-3 rounded-[var(--r-row)] border border-[var(--br-card)] hover:border-[var(--canvas-dark-ink-muted)] transition-colors"
        style={innerStyle}
      >
        {content}
      </Link>
    )
  }
  return (
    <div
      className="block p-3 rounded-[var(--r-row)] border border-[var(--br-card)]"
      style={innerStyle}
    >
      {content}
    </div>
  )
}
