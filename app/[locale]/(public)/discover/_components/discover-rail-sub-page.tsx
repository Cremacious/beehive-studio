import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { DiscoverBookCard } from './discover-book-card'
import type { RailResult, BookCard } from '@/lib/actions/discover.actions'

type LoadMoreSlug =
  | 'trending'
  | 'rising'
  | 'recently-updated'
  | 'new-releases'
  | 'best-ongoing'
  | 'following'
  | 'live-now'
  | 'voting-now'
  | 'heating-up'
  | 'newly-opened'
  | 'recently-won'
  | 'sparks-following'
  | 'recently-active'
  | 'new'
  | 'looking-for-collaborators'

type Props<TItem extends { id: string } = BookCard> = {
  title: string
  description: string
  result: RailResult<TItem>
  locale: string
  loadMoreAction: LoadMoreSlug
  filterRail?: React.ReactNode
  /**
   * Optional custom card renderer. Defaults to <DiscoverBookCard variant="grid">
   * for D1 backward-compat. D2a Sparks sub-pages pass a <DiscoverSparkCard> renderer.
   */
  renderCard?: (item: TItem, locale: string) => React.ReactNode
  /**
   * Optional empty-state copy override. Default: "No books match this filter yet."
   */
  emptyMessage?: string
  /**
   * Optional href prefix for Load more links. Defaults to /${locale}/discover/${action}.
   * D2a Spark sub-pages pass `/${locale}/discover/sparks/`.
   */
  loadMoreHrefBase?: string
}

function defaultRender<TItem extends { id: string }>(
  item: TItem,
  locale: string,
): React.ReactNode {
  return (
    <DiscoverBookCard
      book={item as unknown as BookCard}
      locale={locale}
      variant="grid"
    />
  )
}

export function DiscoverRailSubPage<TItem extends { id: string } = BookCard>({
  title,
  description,
  result,
  locale,
  loadMoreAction,
  filterRail,
  renderCard,
  emptyMessage,
  loadMoreHrefBase,
}: Props<TItem>) {
  const render = renderCard ?? defaultRender
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
          Filling in with recently active items while {title} warms up.
        </p>
      )}

      <div className="grid grid-cols-[240px_1fr] gap-6">
        <aside>{filterRail ?? null}</aside>
        <div>
          {result.books.length === 0 ? (
            <p className="text-[13px] text-[var(--canvas-dark-ink-muted)] italic py-12 text-center">
              {emptyMessage ?? 'No books match this filter yet.'}
            </p>
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-3">
                {result.books.map((item) => (
                  <li key={item.id}>{render(item, locale)}</li>
                ))}
              </ul>
              {result.nextCursor && (
                <LoadMoreLink
                  action={loadMoreAction}
                  cursor={result.nextCursor}
                  locale={locale}
                  hrefBase={loadMoreHrefBase}
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
  hrefBase,
}: {
  action: LoadMoreSlug
  cursor: string
  locale: string
  hrefBase?: string
}) {
  const base = hrefBase ?? `/${locale}/discover/`
  return (
    <div className="mt-6 flex justify-center">
      <Link
        href={`${base}${action}?cursor=${encodeURIComponent(cursor)}`}
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
