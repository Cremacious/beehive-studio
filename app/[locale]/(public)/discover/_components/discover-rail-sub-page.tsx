import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { DiscoverBookCard } from './discover-book-card'
import type { RailResult } from '@/lib/actions/discover.actions'

type LoadMoreSlug =
  | 'trending'
  | 'rising'
  | 'recently-updated'
  | 'new-releases'
  | 'best-ongoing'
  | 'following'

type Props = {
  title: string
  description: string
  result: RailResult
  locale: string
  loadMoreAction: LoadMoreSlug
  filterRail?: React.ReactNode
}

export function DiscoverRailSubPage({
  title,
  description,
  result,
  locale,
  loadMoreAction,
  filterRail,
}: Props) {
  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <Link
        href={`/${locale}/discover`}
        className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] mb-4"
      >
        <ArrowLeft size={12} /> Back to Discover
      </Link>

      <header className="mb-6">
        <h1 className="font-[family-name:var(--font-comfortaa)] font-bold text-[28px] text-[var(--brand)] mb-1">
          {title}
        </h1>
        <p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">{description}</p>
      </header>

      {result.strictCount < 4 && result.books.length > 0 && (
        <p className="mb-4 text-[10px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)] italic">
          Filling in with recently active books while {title} warms up.
        </p>
      )}

      <div className="grid grid-cols-[240px_1fr] gap-6">
        <aside>{filterRail ?? null}</aside>
        <div>
          {result.books.length === 0 ? (
            <p className="text-[13px] text-[var(--canvas-dark-ink-muted)] italic py-12 text-center">
              No books match this filter yet.
            </p>
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-3">
                {result.books.map((book) => (
                  <li key={book.id}>
                    <DiscoverBookCard book={book} locale={locale} variant="grid" />
                  </li>
                ))}
              </ul>
              {result.nextCursor && (
                <LoadMoreLink
                  action={loadMoreAction}
                  cursor={result.nextCursor}
                  locale={locale}
                />
              )}
            </>
          )}
        </div>
      </div>
    </main>
  )
}

// D1 v1: a simple Link that pushes ?cursor=... and lets the server re-fetch
// from that cursor. Append-in-memory pagination is a follow-up.
function LoadMoreLink({
  action,
  cursor,
  locale,
}: {
  action: LoadMoreSlug
  cursor: string
  locale: string
}) {
  return (
    <div className="mt-6 flex justify-center">
      <Link
        href={`/${locale}/discover/${action}?cursor=${encodeURIComponent(cursor)}`}
        className="h-9 px-5 inline-flex items-center rounded-[var(--r-pill)] text-[12px] font-medium"
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          boxShadow: 'var(--sh-tile)',
          color: 'var(--canvas-dark-ink-strong)',
        }}
      >
        Load more
      </Link>
    </div>
  )
}
