import {
  searchListsDiscoverAction,
  getFeaturedListAction,
  type ListCard,
} from '@/lib/actions/discover-lists.actions'
import {
  parseStringParam,
  parseMultiSelect,
  parseRadio,
  buildUrl,
} from '@/lib/discover/url-state'
import { GENRE_LABEL, isValidGenre, type GenreSlug } from '@/lib/discover/genres'
import { SlimFeaturedStrip } from './slim-featured-strip'
import { SortHeader } from './sort-header'
import { ActiveFilterChips, type ActiveFilterChip } from './active-filter-chips'
import { ListGridCard } from './list-grid-card'

type SP = Record<string, string | string[] | undefined>
type Props = { sp: SP; locale: string }

const SIZES = ['any', 'small', 'mid', 'large'] as const
const POPULARITIES = ['any', '10+'] as const
const UPDATEDS = ['anytime', 'month'] as const
const CURATORS = ['anyone', 'following'] as const
const SORTS = ['most-followed', 'recent', 'most-books'] as const

const SIZE_LABEL: Record<(typeof SIZES)[number], string> = {
  any: 'Any size',
  small: 'Small',
  mid: 'Medium',
  large: 'Large',
}
const POPULARITY_LABEL: Record<(typeof POPULARITIES)[number], string> = {
  any: 'Any',
  '10+': '10+ followers',
}
const UPDATED_LABEL: Record<(typeof UPDATEDS)[number], string> = {
  anytime: 'Anytime',
  month: 'This month',
}
const CURATOR_LABEL: Record<(typeof CURATORS)[number], string> = {
  anyone: 'Anyone',
  following: 'Following',
}

const SORT_OPTIONS = [
  { value: 'most-followed', label: 'Most followed' },
  { value: 'recent', label: 'Most recent' },
  { value: 'most-books', label: 'Most books' },
] as const

function pickRaw(sp: SP, key: string): string | undefined {
  const v = sp[key]
  return typeof v === 'string' ? v : undefined
}

function buildChips(sp: SP, locale: string): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = []
  const q = parseStringParam(pickRaw(sp, 'q'))
  const genres = parseMultiSelect(pickRaw(sp, 'genres'))
  const size = parseRadio(pickRaw(sp, 'size'), SIZES, 'any')
  const popularity = parseRadio(
    pickRaw(sp, 'popularity'),
    POPULARITIES,
    'any',
  )
  const updated = parseRadio(pickRaw(sp, 'updated'), UPDATEDS, 'anytime')
  const curator = parseRadio(pickRaw(sp, 'curator'), CURATORS, 'anyone')
  const sort = parseRadio(pickRaw(sp, 'sort'), SORTS, 'most-followed')

  const all: Record<string, string | string[] | undefined> = {
    q,
    genres: genres.length ? genres : undefined,
    size: size !== 'any' ? size : undefined,
    popularity: popularity !== 'any' ? popularity : undefined,
    updated: updated !== 'anytime' ? updated : undefined,
    curator: curator !== 'anyone' ? curator : undefined,
    sort: sort !== 'most-followed' ? sort : undefined,
  }
  const without = (key: string) =>
    buildUrl('lists', { ...all, [key]: undefined }, `/${locale}/discover`)
  const withoutGenre = (slug: string) => {
    const next = genres.filter((g) => g !== slug)
    return buildUrl(
      'lists',
      { ...all, genres: next.length ? next : undefined },
      `/${locale}/discover`,
    )
  }

  if (q) chips.push({ label: `Search: ${q}`, removeHref: without('q') })
  for (const g of genres) {
    if (isValidGenre(g)) {
      chips.push({
        label: GENRE_LABEL[g as GenreSlug],
        removeHref: withoutGenre(g),
      })
    }
  }
  if (size !== 'any')
    chips.push({ label: SIZE_LABEL[size], removeHref: without('size') })
  if (popularity !== 'any')
    chips.push({
      label: POPULARITY_LABEL[popularity],
      removeHref: without('popularity'),
    })
  if (updated !== 'anytime')
    chips.push({ label: UPDATED_LABEL[updated], removeHref: without('updated') })
  if (curator !== 'anyone')
    chips.push({ label: CURATOR_LABEL[curator], removeHref: without('curator') })
  return chips
}

export async function ListsGrid({ sp, locale }: Props) {
  const q = parseStringParam(pickRaw(sp, 'q'))
  const genres = parseMultiSelect(pickRaw(sp, 'genres'))
  const size = parseRadio(pickRaw(sp, 'size'), SIZES, 'any')
  const popularity = parseRadio(
    pickRaw(sp, 'popularity'),
    POPULARITIES,
    'any',
  )
  const updated = parseRadio(pickRaw(sp, 'updated'), UPDATEDS, 'anytime')
  const curator = parseRadio(pickRaw(sp, 'curator'), CURATORS, 'anyone')
  const sort = parseRadio(pickRaw(sp, 'sort'), SORTS, 'most-followed')

  const [resultsRes, featuredRes] = await Promise.all([
    searchListsDiscoverAction({
      q,
      genres,
      size,
      popularity,
      updated,
      curator,
      sort,
    }),
    getFeaturedListAction({}),
  ])

  const lists: ListCard[] = resultsRes.success ? resultsRes.data.books : []
  const featured =
    featuredRes.success && featuredRes.data
      ? {
          title: featuredRes.data.title,
          caption: featuredRes.data.ownerUsername
            ? `by @${featuredRes.data.ownerUsername}`
            : `${featuredRes.data.bookCount} books`,
          href: `/${locale}/reading-lists/${featuredRes.data.id}`,
        }
      : null

  return (
    <div className="flex flex-col gap-4">
      <SlimFeaturedStrip kind="list" featured={featured} />
      <SortHeader
        count={lists.length}
        entityNoun={lists.length === 1 ? 'list' : 'lists'}
        sortOptions={SORT_OPTIONS.map((o) => ({ ...o }))}
        selectedSort={sort}
      />
      <ActiveFilterChips chips={buildChips(sp, locale)} />
      {lists.length === 0 ? (
        <p className="italic text-[var(--canvas-dark-ink-muted)] py-8 text-center">
          No lists match these filters. Try clearing one.
        </p>
      ) : (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            justifyItems: 'start',
          }}
        >
          {lists.map((list) => (
            <ListGridCard key={list.id} list={list} locale={locale} />
          ))}
        </div>
      )}
    </div>
  )
}
