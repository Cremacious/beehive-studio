import {
  searchBooksDiscoverAction,
  getFeaturedFreshBookAction,
  type BookCard,
} from '@/lib/actions/discover.actions'
import {
  parseStringParam,
  parseMultiSelect,
  parseRadio,
  parseIntParam,
  buildUrl,
} from '@/lib/discover/url-state'
import { GENRE_LABEL, isValidGenre, type GenreSlug } from '@/lib/discover/genres'
import { SlimFeaturedStrip } from './slim-featured-strip'
import { SortHeader } from './sort-header'
import { ActiveFilterChips, type ActiveFilterChip } from './active-filter-chips'
import { BookGridCard } from './book-grid-card'
import { NumberedPagination } from './numbered-pagination'

const PAGE_SIZE = 12

type SP = Record<string, string | string[] | undefined>

type Props = {
  sp: SP
  locale: string
}

const LENGTHS = ['any', 'short', 'novella', 'novel', 'epic'] as const
const STATUSES = ['any', 'ongoing', 'completed'] as const
const SERIES = ['any', 'standalone', 'in-series'] as const
const UPDATED = ['anytime', 'week', 'month'] as const
const SORTS = ['trending', 'recent', 'most-liked', 'a-z'] as const

const LENGTH_LABEL: Record<(typeof LENGTHS)[number], string> = {
  any: 'Any length',
  short: 'Short',
  novella: 'Novella',
  novel: 'Novel',
  epic: 'Epic',
}
const STATUS_LABEL: Record<(typeof STATUSES)[number], string> = {
  any: 'Any status',
  ongoing: 'Ongoing',
  completed: 'Completed',
}
const SERIES_LABEL: Record<(typeof SERIES)[number], string> = {
  any: 'Any',
  standalone: 'Standalone',
  'in-series': 'In series',
}
const UPDATED_LABEL: Record<(typeof UPDATED)[number], string> = {
  anytime: 'Anytime',
  week: 'This week',
  month: 'This month',
}

const SORT_OPTIONS = [
  { value: 'trending', label: 'Trending' },
  { value: 'recent', label: 'Most recent' },
  { value: 'most-liked', label: 'Most liked' },
  { value: 'a-z', label: 'A–Z' },
] as const

function pickRaw(sp: SP, key: string): string | undefined {
  const v = sp[key]
  return typeof v === 'string' ? v : undefined
}

// Maps the redesign's sort enum onto the action's existing sort param.
// 'trending' and 'a-z' currently fall back to 'recent' until the action grows
// dedicated branches. Documented in spec §11 as a deferred polish item.
function mapSortToAction(
  sort: (typeof SORTS)[number],
): 'recent' | 'popular' | 'relevance' {
  if (sort === 'most-liked') return 'popular'
  return 'recent'
}

function buildChips(sp: SP, locale: string): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = []
  const q = parseStringParam(pickRaw(sp, 'q'))
  const genres = parseMultiSelect(pickRaw(sp, 'genres'))
  const length = parseRadio(pickRaw(sp, 'length'), LENGTHS, 'any')
  const status = parseRadio(pickRaw(sp, 'status'), STATUSES, 'any')
  const series = parseRadio(pickRaw(sp, 'series'), SERIES, 'any')
  const updated = parseRadio(pickRaw(sp, 'updated'), UPDATED, 'anytime')
  const sort = parseRadio(pickRaw(sp, 'sort'), SORTS, 'trending')

  // Build a base map of all current params, then per chip create a "without me" URL.
  const all: Record<string, string | string[] | undefined> = {
    q,
    genres: genres.length ? genres : undefined,
    length: length !== 'any' ? length : undefined,
    status: status !== 'any' ? status : undefined,
    series: series !== 'any' ? series : undefined,
    updated: updated !== 'anytime' ? updated : undefined,
    sort: sort !== 'trending' ? sort : undefined,
  }

  function withoutKey(key: string): string {
    return buildUrl('books', { ...all, [key]: undefined }, `/${locale}/discover`)
  }
  function withoutGenre(slug: string): string {
    const next = genres.filter((g) => g !== slug)
    return buildUrl(
      'books',
      { ...all, genres: next.length ? next : undefined },
      `/${locale}/discover`,
    )
  }

  if (q) chips.push({ label: `Search: ${q}`, removeHref: withoutKey('q') })
  for (const g of genres) {
    if (isValidGenre(g)) {
      chips.push({
        label: GENRE_LABEL[g as GenreSlug],
        removeHref: withoutGenre(g),
      })
    }
  }
  if (length !== 'any') {
    chips.push({ label: LENGTH_LABEL[length], removeHref: withoutKey('length') })
  }
  if (status !== 'any') {
    chips.push({ label: STATUS_LABEL[status], removeHref: withoutKey('status') })
  }
  if (series !== 'any') {
    chips.push({ label: SERIES_LABEL[series], removeHref: withoutKey('series') })
  }
  if (updated !== 'anytime') {
    chips.push({
      label: UPDATED_LABEL[updated],
      removeHref: withoutKey('updated'),
    })
  }
  return chips
}

export async function BooksGrid({ sp, locale }: Props) {
  const q = parseStringParam(pickRaw(sp, 'q'))
  const genres = parseMultiSelect(pickRaw(sp, 'genres'))
  const length = parseRadio(pickRaw(sp, 'length'), LENGTHS, 'any')
  const status = parseRadio(pickRaw(sp, 'status'), STATUSES, 'any')
  const series = parseRadio(pickRaw(sp, 'series'), SERIES, 'any')
  const updated = parseRadio(pickRaw(sp, 'updated'), UPDATED, 'anytime')
  const sort = parseRadio(pickRaw(sp, 'sort'), SORTS, 'trending')
  const page = Math.max(1, parseIntParam(pickRaw(sp, 'page'), 1))

  const [resultsRes, featuredRes] = await Promise.all([
    searchBooksDiscoverAction({
      q,
      genres,
      length,
      status,
      series,
      updated,
      sort: mapSortToAction(sort),
      page,
    }),
    getFeaturedFreshBookAction({}),
  ])

  const books: BookCard[] = resultsRes.success ? resultsRes.data.books : []
  const totalCount: number = resultsRes.success ? resultsRes.data.totalCount : 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const featured =
    featuredRes.success && featuredRes.data
      ? {
          title: featuredRes.data.title,
          caption: featuredRes.data.authorUsername
            ? `Fresh from @${featuredRes.data.authorUsername}`
            : 'A fresh new release',
          href: `/${locale}/books/${featuredRes.data.id}`,
        }
      : null

  const chips = buildChips(sp, locale)

  return (
    <div className="flex flex-col gap-4">
      <SlimFeaturedStrip kind="book" featured={featured} />
      <SortHeader
        count={totalCount}
        entityNoun={totalCount === 1 ? 'book' : 'books'}
        sortOptions={SORT_OPTIONS.map((o) => ({ ...o }))}
        selectedSort={sort}
      />
      <ActiveFilterChips chips={chips} />
      {books.length === 0 ? (
        <p className="italic text-[var(--canvas-dark-ink-muted)] py-8 text-center">
          No books match these filters. Try clearing one.
        </p>
      ) : (
        <>
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              justifyItems: 'start',
            }}
          >
            {books.map((book) => (
              <BookGridCard key={book.id} book={book} locale={locale} />
            ))}
          </div>
          <NumberedPagination
            tab="books"
            locale={locale}
            page={page}
            totalPages={totalPages}
            baseParams={{
              q,
              genres: genres.length ? genres : undefined,
              length: length !== 'any' ? length : undefined,
              status: status !== 'any' ? status : undefined,
              series: series !== 'any' ? series : undefined,
              updated: updated !== 'anytime' ? updated : undefined,
              sort: sort !== 'trending' ? sort : undefined,
            }}
          />
        </>
      )}
    </div>
  )
}
