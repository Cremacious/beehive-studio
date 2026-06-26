import {
  searchListsDiscoverAction,
  getFeaturedListAction,
  getForYouListsAction,
  type ListCard,
} from '@/lib/actions/discover-lists.actions'
import { SlimFeaturedStrip } from './slim-featured-strip'
import { ModeDescriptor } from './mode-descriptor'
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
import { hasAnyDiscoverySignalAction } from '@/lib/actions/discover-for-you-books.actions'
import { GENRE_LABEL, isValidGenre, type GenreSlug } from '@/lib/discover/genres'
import { DiscoveryModeToggle } from './discovery-mode-toggle'
import { FilterSearchInput } from './filter-search-input'
import { SortHeader } from './sort-header'
import { ActiveFilterChips, type ActiveFilterChip } from './active-filter-chips'
import { ListGridCard } from './list-grid-card'
import { NumberedPagination } from './numbered-pagination'

const PAGE_SIZE = 12

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
  const tags = parseMultiSelect(pickRaw(sp, 'tags')).map((t) =>
    t.toLowerCase(),
  )
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
    tags: tags.length ? tags : undefined,
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
  const withoutTag = (tag: string) => {
    const next = tags.filter((t) => t !== tag)
    return buildUrl(
      'lists',
      { ...all, tags: next.length ? next : undefined },
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
  for (const t of tags) {
    chips.push({ label: `tag: ${t}`, removeHref: withoutTag(t) })
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
  const viewerId = await getOptionalUserId()
  const isAuthed = viewerId !== null
  const parsedMode = parseMode(pickRaw(sp, 'mode'))
  let resolvedMode: ModeId
  if (parsedMode) {
    resolvedMode = parsedMode === 'for-you' && !isAuthed ? 'trending' : parsedMode
  } else {
    const hasSignal = isAuthed ? await hasAnyDiscoverySignalAction(viewerId!) : false
    resolvedMode = resolveDefaultMode({ isAuthed, hasSignal })
  }

  const q = parseStringParam(pickRaw(sp, 'q'))
  const genres = parseMultiSelect(pickRaw(sp, 'genres'))
  const tags = parseMultiSelect(pickRaw(sp, 'tags')).map((t) =>
    t.toLowerCase(),
  )
  const size = parseRadio(pickRaw(sp, 'size'), SIZES, 'any')
  const popularity = parseRadio(
    pickRaw(sp, 'popularity'),
    POPULARITIES,
    'any',
  )
  const updated = parseRadio(pickRaw(sp, 'updated'), UPDATEDS, 'anytime')
  const curator = parseRadio(pickRaw(sp, 'curator'), CURATORS, 'anyone')
  const sort = parseRadio(pickRaw(sp, 'sort'), SORTS, 'most-followed')
  const page = Math.max(1, parseIntParam(pickRaw(sp, 'page'), 1))

  const resultsRes = await (async () => {
    switch (resolvedMode) {
      case 'for-you': {
        if (!viewerId) {
          return searchListsDiscoverAction({
            q, genres, tags, size, popularity, updated, curator,
            sort: 'most-followed', page,
          })
        }
        const forYou = await getForYouListsAction({ viewerId, page })
        if (!forYou.success) return forYou
        return {
          success: true as const,
          data: {
            books: forYou.data.lists,
            totalCount: forYou.data.totalCount,
            nextCursor: null as string | null,
          },
        }
      }
      case 'trending':
        return searchListsDiscoverAction({
          q,
          genres,
          tags,
          size,
          popularity,
          updated,
          curator,
          sort: 'recent',
          page,
        })
      case 'popular':
        return searchListsDiscoverAction({
          q,
          genres,
          tags,
          size,
          popularity,
          updated,
          curator,
          sort: 'most-followed',
          page,
        })
      case 'all':
      default:
        return searchListsDiscoverAction({
          q,
          genres,
          tags,
          size,
          popularity,
          updated,
          curator,
          sort,
          page,
        })
    }
  })()

  const lists: ListCard[] = resultsRes.success ? resultsRes.data.books : []
  const totalCount: number = resultsRes.success ? resultsRes.data.totalCount : 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const showFeatured = resolvedMode === 'all' || resolvedMode === 'for-you'
  const featuredGenre = genres.find((g): g is GenreSlug => isValidGenre(g))
  const featuredRes = showFeatured
    ? await getFeaturedListAction({ genre: featuredGenre })
    : null
  const featured =
    featuredRes && featuredRes.success && featuredRes.data
      ? {
          title: featuredRes.data.title,
          caption: 'Rising curator',
          href: `/${locale}/reading-lists/${featuredRes.data.id}`,
        }
      : null

  const toggleBaseParams: Record<string, string | string[] | undefined> = {
    q,
    genres: genres.length ? genres : undefined,
    tags: tags.length ? tags : undefined,
    size: size !== 'any' ? size : undefined,
    popularity: popularity !== 'any' ? popularity : undefined,
    updated: updated !== 'anytime' ? updated : undefined,
    curator: curator !== 'anyone' ? curator : undefined,
    sort: sort !== 'most-followed' ? sort : undefined,
  }

  // Tag pills on cards toggle the tag in the current `?tags=` filter,
  // preserving every other filter param. Adding a tag the viewer already has
  // selected is a no-op (the toggle removes it instead).
  const activeTagSet = new Set(tags)
  const tagHrefBuilder = (tag: string): string => {
    const next = activeTagSet.has(tag)
      ? tags.filter((t) => t !== tag)
      : [...tags, tag]
    return buildUrl(
      'lists',
      { ...toggleBaseParams, tags: next.length ? next : undefined },
      `/${locale}/discover`,
    )
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
        <FilterSearchInput name="q" placeholder="List title, curator…" initialValue={q ?? ''} variant="hero" />
        <DiscoveryModeToggle
          tab="lists"
          locale={locale}
          current={resolvedMode}
          isAuthed={isAuthed}
          baseParams={toggleBaseParams}
        />
        <ModeDescriptor mode={resolvedMode} tab="lists" />
        {showFeatured ? <SlimFeaturedStrip kind="list" featured={featured} /> : null}
      </div>
      <SortHeader
        count={totalCount}
        entityNoun={totalCount === 1 ? 'list' : 'lists'}
        sortOptions={SORT_OPTIONS.map((o) => ({ ...o }))}
        selectedSort={sort}
      />
      <ActiveFilterChips chips={buildChips(sp, locale)} />
      {lists.length === 0 ? (
        <p className="italic text-[var(--canvas-dark-ink-muted)] py-8 text-center">
          No lists match these filters. Try clearing one.
        </p>
      ) : (
        <>
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
              alignItems: 'stretch',
            }}
          >
            {lists.map((list) => (
              <ListGridCard
                key={list.id}
                list={list}
                locale={locale}
                tagHrefBuilder={tagHrefBuilder}
              />
            ))}
          </div>
          <NumberedPagination
            tab="lists"
            locale={locale}
            page={page}
            totalPages={totalPages}
            baseParams={{
              q,
              genres: genres.length ? genres : undefined,
              tags: tags.length ? tags : undefined,
              size: size !== 'any' ? size : undefined,
              popularity: popularity !== 'any' ? popularity : undefined,
              updated: updated !== 'anytime' ? updated : undefined,
              curator: curator !== 'anyone' ? curator : undefined,
              sort: sort !== 'most-followed' ? sort : undefined,
            }}
          />
        </>
      )}
    </div>
  )
}
