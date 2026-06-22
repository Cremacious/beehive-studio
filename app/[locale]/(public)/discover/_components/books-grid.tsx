import {
  searchBooksDiscoverAction,
  getTrendingBooksAction,
  type BookCard,
} from '@/lib/actions/discover.actions'
import {
  getForYouBooksAction,
  getPopularBooksAction,
  hasAnyDiscoverySignalAction,
} from '@/lib/actions/discover-for-you-books.actions'
import {
  parseStringParam,
  parseMultiSelect,
  parseRadio,
  parseIntParam,
  parseMode,
  buildUrl,
  type ModeId,
} from '@/lib/discover/url-state'
import { resolveDefaultMode } from '@/lib/discover/resolve-default-mode'
import { getOptionalUserId } from '@/lib/require-auth'
import { GENRE_LABEL, isValidGenre, type GenreSlug } from '@/lib/discover/genres'
import { DiscoveryModeToggle } from './discovery-mode-toggle'
import { FilterSearchInput } from './filter-search-input'
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
const SORTS = ['recent', 'a-z'] as const

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
  { value: 'recent', label: 'Most recent' },
  { value: 'a-z', label: 'A–Z' },
] as const

function pickRaw(sp: SP, key: string): string | undefined {
  const v = sp[key]
  return typeof v === 'string' ? v : undefined
}

// Maps the narrowed sort enum onto the 'all' search action's existing sort param.
// TODO(plan): `searchBooksDiscoverAction` does not yet have a true 'a-z'
// branch — it falls back to 'recent'. Spec §11 deferred polish item.
function mapSortToAction(
  sort: (typeof SORTS)[number],
): 'recent' | 'popular' | 'relevance' {
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
  const sort = parseRadio(pickRaw(sp, 'sort'), SORTS, 'recent')
  const modeRaw = pickRaw(sp, 'mode')

  // Build a base map of all current params, then per chip create a "without me" URL.
  const all: Record<string, string | string[] | undefined> = {
    q,
    genres: genres.length ? genres : undefined,
    length: length !== 'any' ? length : undefined,
    status: status !== 'any' ? status : undefined,
    series: series !== 'any' ? series : undefined,
    updated: updated !== 'anytime' ? updated : undefined,
    sort: sort !== 'recent' ? sort : undefined,
    mode: modeRaw,
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
  const viewerId = await getOptionalUserId()
  const isAuthed = viewerId !== null

  const q = parseStringParam(pickRaw(sp, 'q'))
  const genres = parseMultiSelect(pickRaw(sp, 'genres'))
  const length = parseRadio(pickRaw(sp, 'length'), LENGTHS, 'any')
  const status = parseRadio(pickRaw(sp, 'status'), STATUSES, 'any')
  const series = parseRadio(pickRaw(sp, 'series'), SERIES, 'any')
  const updated = parseRadio(pickRaw(sp, 'updated'), UPDATED, 'anytime')
  const sort = parseRadio(pickRaw(sp, 'sort'), SORTS, 'recent')
  const page = Math.max(1, parseIntParam(pickRaw(sp, 'page'), 1))

  // Resolve active discovery mode.
  const parsedMode = parseMode(pickRaw(sp, 'mode'))
  let resolvedMode: ModeId
  if (parsedMode) {
    // Silent guest fallback: ?mode=for-you with no auth → trending.
    if (parsedMode === 'for-you' && !isAuthed) {
      resolvedMode = 'trending'
    } else {
      resolvedMode = parsedMode
    }
  } else {
    const hasSignal = isAuthed
      ? await hasAnyDiscoverySignalAction(viewerId!)
      : false
    resolvedMode = resolveDefaultMode({ isAuthed, hasSignal })
  }

  const filterInputs = {
    q,
    genres: genres.length ? genres : undefined,
    length,
    status,
    series,
    updated,
  }

  const resultsRes = await (async () => {
    switch (resolvedMode) {
      case 'for-you':
        return getForYouBooksAction({
          viewerId: viewerId!,
          page,
          filters: filterInputs,
        })
      case 'trending':
        return getTrendingBooksAction({ page, filters: filterInputs })
      case 'popular':
        return getPopularBooksAction({ page, filters: filterInputs })
      case 'all':
        return searchBooksDiscoverAction({
          q,
          genres,
          length,
          status,
          series,
          updated,
          sort: mapSortToAction(sort),
          page,
        })
    }
  })()

  const books: BookCard[] = resultsRes.success ? resultsRes.data.books : []
  const totalCount: number = resultsRes.success ? resultsRes.data.totalCount : 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const chips = buildChips(sp, locale)

  // baseParams for DiscoveryModeToggle (no mode, no page).
  const toggleBaseParams: Record<string, string | string[] | undefined> = {
    q,
    genres: genres.length ? genres : undefined,
    length: length !== 'any' ? length : undefined,
    status: status !== 'any' ? status : undefined,
    series: series !== 'any' ? series : undefined,
    updated: updated !== 'anytime' ? updated : undefined,
    sort: sort !== 'recent' ? sort : undefined,
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: 'var(--sh-card)',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <FilterSearchInput name="q" placeholder="Title, author, tag…" initialValue={q ?? ''} variant="hero" />
        <DiscoveryModeToggle
          tab="books"
          locale={locale}
          current={resolvedMode}
          isAuthed={isAuthed}
          baseParams={toggleBaseParams}
        />
      </div>
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
              sort: sort !== 'recent' ? sort : undefined,
              mode: resolvedMode === 'all' ? undefined : resolvedMode,
            }}
          />
        </>
      )}
    </div>
  )
}
