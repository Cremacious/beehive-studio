import { redirect } from 'next/navigation'
import { Bookmark } from 'lucide-react'
import { getOptionalUserId } from '@/lib/require-auth'
import { parseRadio, parseIntParam, parseMultiSelect, parseStringParam } from '@/lib/discover/url-state'
import {
  getBookmarkedBooksAction,
  getBookmarksEmptySuggestionsAction,
  type BookmarkSort,
  type BookmarkStatus,
} from '@/lib/actions/library.actions'
import { BackToCommunity } from '@/components/community/back-to-community'
import { BookmarksGrid } from './_components/bookmarks-grid'
import { BookmarksSortDropdown } from './_components/bookmarks-sort-dropdown'
import { BookmarksSidebar } from './_components/bookmarks-sidebar'
import { ActiveFilterChips } from './_components/active-filter-chips'
import { NumberedPagination } from './_components/numbered-pagination'
import { BookmarksEmpty } from './_components/bookmarks-empty'

type SP = Record<string, string | string[] | undefined>
type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<SP>
}

const PAGE_SIZE = 24

function pickRaw(sp: SP, key: string): string | undefined {
  const v = sp[key]
  return typeof v === 'string' ? v : undefined
}

export default async function BookmarksPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams

  const viewerId = await getOptionalUserId()
  if (!viewerId) {
    redirect(
      `/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/community/bookmarks`)}`,
    )
  }

  const q = parseStringParam(pickRaw(sp, 'q'), 80) ?? ''
  const status = parseRadio(
    pickRaw(sp, 'status'),
    ['all', 'reading', 'not-started', 'finished'] as const,
    'all',
  ) as BookmarkStatus
  const genres = parseMultiSelect(pickRaw(sp, 'genres'))
  const sort = parseRadio(
    pickRaw(sp, 'sort'),
    ['recent', 'title', 'author', 'progress'] as const,
    'recent',
  ) as BookmarkSort
  const page = Math.max(1, parseIntParam(pickRaw(sp, 'page'), 1))

  const result = await getBookmarkedBooksAction({ q, status, genres, sort, page })

  if (!result.success) {
    return (
      <main className="page-x tier-wide pt-7 pb-6">
        <BackToCommunity href={`/${locale}/community`} />
        <p className="text-red-400 text-sm">Could not load bookmarks.</p>
      </main>
    )
  }

  const { rows, totalCount, filteredCount, facets } = result.data
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE))
  const isEmpty = totalCount === 0

  // Empty-state trending strip — only fetched when the shelf is completely
  // empty (saves the query on every populated render).
  const trending = isEmpty
    ? (await getBookmarksEmptySuggestionsAction({ limit: 8 }))
    : null
  const trendingRows = trending && trending.success ? trending.data : []

  function buildPageHref(targetPage: number): string {
    const next = new URLSearchParams()
    if (q) next.set('q', q)
    if (status !== 'all') next.set('status', status)
    if (genres.length > 0) next.set('genres', genres.join(','))
    if (sort !== 'recent') next.set('sort', sort)
    if (targetPage > 1) next.set('page', String(targetPage))
    const qs = next.toString()
    return qs
      ? `/${locale}/community/bookmarks?${qs}`
      : `/${locale}/community/bookmarks`
  }

  const hasActiveFilters = q !== '' || status !== 'all' || genres.length > 0

  return (
    <main className="page-x tier-wide pt-7 pb-12">
      <BackToCommunity href={`/${locale}/community`} />

      <div className="grid gap-6 max-md:gap-4 items-start grid-cols-1 md:[grid-template-columns:minmax(0,260px)_minmax(0,1fr)]">
        <BookmarksSidebar
          facets={facets}
          currentStatus={status}
          currentGenres={genres}
          currentQuery={q}
          isEmpty={isEmpty}
        />

        <div className="min-w-0">
          <header className="flex items-end justify-between gap-4 mb-5 flex-wrap">
            <div>
              <h1
                className="m-0 text-[30px] max-md:text-[22px] font-bold leading-tight flex items-center gap-3.5 max-md:gap-2.5"
                style={{
                  color: 'var(--canvas-dark-ink-strong)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                <Bookmark
                  size={28}
                  style={{ color: 'var(--brand)' }}
                  fill="currentColor"
                  aria-hidden="true"
                />
                Bookmarked books
              </h1>
              <p
                className="mt-1 m-0 text-[13px]"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                {summary(totalCount, facets.status.reading, isEmpty)}
              </p>
            </div>
            {!isEmpty ? <BookmarksSortDropdown selected={sort} /> : null}
          </header>

          {isEmpty ? (
            <BookmarksEmpty locale={locale} trending={trendingRows} />
          ) : (
            <>
              <ActiveFilterChips query={q} status={status} genres={genres} />

              {filteredCount === 0 ? (
                <NoResultsHit hasActiveFilters={hasActiveFilters} />
              ) : (
                <>
                  <BookmarksGrid rows={rows} locale={locale} />
                  <NumberedPagination
                    currentPage={page}
                    totalPages={totalPages}
                    buildHref={buildPageHref}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  )
}

function summary(total: number, reading: number, isEmpty: boolean): string {
  if (isEmpty) return 'Nothing here yet.'
  const a = `${total} ${total === 1 ? 'book' : 'books'}`
  if (reading === 0) return `${a}.`
  return `${a}, ${reading} currently reading.`
}

function NoResultsHit({ hasActiveFilters }: { hasActiveFilters: boolean }) {
  return (
    <div
      className="text-center py-20 px-6"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        border: '0.5px solid oklch(1 0 0 / 0.04)',
      }}
    >
      <h2
        className="m-0 mb-2 text-[18px] font-bold"
        style={{
          color: 'var(--canvas-dark-ink-strong)',
          fontFamily: 'var(--font-display)',
        }}
      >
        No matches
      </h2>
      <p
        className="m-0 max-w-md mx-auto text-[13px]"
        style={{ color: 'var(--canvas-dark-ink-muted)', lineHeight: 1.55 }}
      >
        {hasActiveFilters
          ? 'Try clearing a filter or two to widen the search.'
          : 'Your bookmarks are here, just not matching this view.'}
      </p>
    </div>
  )
}
