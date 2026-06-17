import {
  searchClubsDiscoverAction,
  getFeaturedClubAction,
  type ClubCard,
} from '@/lib/actions/discover-clubs.actions'
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
import { SlimFeaturedStrip } from './slim-featured-strip'
import { SortHeader } from './sort-header'
import { ActiveFilterChips, type ActiveFilterChip } from './active-filter-chips'
import { ClubGridCard } from './club-grid-card'
import { NumberedPagination } from './numbered-pagination'

const PAGE_SIZE = 12

type SP = Record<string, string | string[] | undefined>
type Props = { sp: SP; locale: string }

const SIZES = ['any', 'intimate', 'mid', 'large'] as const
const ACTIVITIES = ['any', 'week'] as const
const SORTS = ['most-active', 'recent', 'most-members'] as const

const SIZE_LABEL: Record<(typeof SIZES)[number], string> = {
  any: 'Any size',
  intimate: 'Intimate',
  mid: 'Medium',
  large: 'Large',
}
const ACTIVITY_LABEL: Record<(typeof ACTIVITIES)[number], string> = {
  any: 'Any',
  week: 'Active this week',
}
const ACCESS_LABEL: Record<string, string> = {
  open: 'Open to join',
  approval: 'Approval required',
}
const CURRENT_LABEL: Record<string, string> = {
  'has-current': 'Has current book',
  between: 'Between books',
}

const SORT_OPTIONS = [
  { value: 'most-active', label: 'Most active' },
  { value: 'recent', label: 'Most recent' },
  { value: 'most-members', label: 'Most members' },
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
  const access = parseMultiSelect(pickRaw(sp, 'accessStates'))
  const activity = parseRadio(pickRaw(sp, 'activity'), ACTIVITIES, 'any')
  const currentBook = parseMultiSelect(pickRaw(sp, 'currentBook'))
  const sort = parseRadio(pickRaw(sp, 'sort'), SORTS, 'most-active')

  const all: Record<string, string | string[] | undefined> = {
    q,
    genres: genres.length ? genres : undefined,
    size: size !== 'any' ? size : undefined,
    accessStates: access.length ? access : undefined,
    activity: activity !== 'any' ? activity : undefined,
    currentBook: currentBook.length ? currentBook : undefined,
    sort: sort !== 'most-active' ? sort : undefined,
  }
  const without = (key: string) =>
    buildUrl('clubs', { ...all, [key]: undefined }, `/${locale}/discover`)
  const withoutMulti = (
    key: 'genres' | 'accessStates' | 'currentBook',
    val: string,
  ) => {
    const current =
      key === 'genres' ? genres : key === 'accessStates' ? access : currentBook
    const next = current.filter((v) => v !== val)
    return buildUrl(
      'clubs',
      { ...all, [key]: next.length ? next : undefined },
      `/${locale}/discover`,
    )
  }

  if (q) chips.push({ label: `Search: ${q}`, removeHref: without('q') })
  for (const g of genres) {
    if (isValidGenre(g)) {
      chips.push({
        label: GENRE_LABEL[g as GenreSlug],
        removeHref: withoutMulti('genres', g),
      })
    }
  }
  if (size !== 'any')
    chips.push({ label: SIZE_LABEL[size], removeHref: without('size') })
  for (const a of access) {
    const label = ACCESS_LABEL[a]
    if (label)
      chips.push({ label, removeHref: withoutMulti('accessStates', a) })
  }
  if (activity !== 'any')
    chips.push({
      label: ACTIVITY_LABEL[activity],
      removeHref: without('activity'),
    })
  for (const c of currentBook) {
    const label = CURRENT_LABEL[c]
    if (label) chips.push({ label, removeHref: withoutMulti('currentBook', c) })
  }
  return chips
}

export async function ClubsGrid({ sp, locale }: Props) {
  const viewerId = await getOptionalUserId()
  const isAuthed = viewerId !== null

  const q = parseStringParam(pickRaw(sp, 'q'))
  const genres = parseMultiSelect(pickRaw(sp, 'genres'))
  const size = parseRadio(pickRaw(sp, 'size'), SIZES, 'any')
  const access = parseMultiSelect(pickRaw(sp, 'accessStates')) as Array<
    'open' | 'approval'
  >
  const currentBook = parseMultiSelect(pickRaw(sp, 'currentBook')) as Array<
    'has-current' | 'between'
  >
  const sort = parseRadio(pickRaw(sp, 'sort'), SORTS, 'most-active')
  const page = Math.max(1, parseIntParam(pickRaw(sp, 'page'), 1))

  // Resolve active discovery mode.
  const parsedMode = parseMode(pickRaw(sp, 'mode'))
  let resolvedMode: ModeId
  if (parsedMode) {
    resolvedMode = parsedMode === 'for-you' && !isAuthed ? 'trending' : parsedMode
  } else {
    const hasSignal = isAuthed ? await hasAnyDiscoverySignalAction(viewerId!) : false
    resolvedMode = resolveDefaultMode({ isAuthed, hasSignal })
  }

  const [resultsRes, featuredRes] = await Promise.all([
    (() => {
      switch (resolvedMode) {
        case 'for-you':
          return searchClubsDiscoverAction({
            q,
            genres,
            size,
            accessStates: access,
            currentBook,
            sort: 'most-active',
            source: 'following',
            viewerId: viewerId ?? undefined,
            page,
          })
        case 'trending':
          return searchClubsDiscoverAction({
            q,
            genres,
            size,
            accessStates: access,
            currentBook,
            sort: 'most-active',
            page,
          })
        case 'popular':
          return searchClubsDiscoverAction({
            q,
            genres,
            size,
            accessStates: access,
            currentBook,
            sort: 'most-members',
            page,
          })
        case 'all':
        default:
          return searchClubsDiscoverAction({
            q,
            genres,
            size,
            accessStates: access,
            currentBook,
            sort,
            page,
          })
      }
    })(),
    getFeaturedClubAction({}),
  ])

  const clubs: ClubCard[] = resultsRes.success ? resultsRes.data.books : []
  const totalCount: number = resultsRes.success ? resultsRes.data.totalCount : 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const featured =
    featuredRes.success && featuredRes.data
      ? {
          title: featuredRes.data.name,
          caption: featuredRes.data.currentBookTitle
            ? `reading ${featuredRes.data.currentBookTitle}`
            : `${featuredRes.data.memberCount} members`,
          href: `/${locale}/clubs/${featuredRes.data.id}`,
        }
      : null

  const toggleBaseParams: Record<string, string | string[] | undefined> = {
    q,
    genres: genres.length ? genres : undefined,
    size: size !== 'any' ? size : undefined,
    accessStates: access.length ? access : undefined,
    currentBook: currentBook.length ? currentBook : undefined,
    sort: sort !== 'most-active' ? sort : undefined,
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
        <FilterSearchInput name="q" placeholder="Club name…" initialValue={q ?? ''} variant="hero" />
        <DiscoveryModeToggle
          tab="clubs"
          locale={locale}
          current={resolvedMode}
          isAuthed={isAuthed}
          baseParams={toggleBaseParams}
        />
      </div>
      <SlimFeaturedStrip kind="club" featured={featured} />
      <SortHeader
        count={totalCount}
        entityNoun={totalCount === 1 ? 'club' : 'clubs'}
        sortOptions={SORT_OPTIONS.map((o) => ({ ...o }))}
        selectedSort={sort}
      />
      <ActiveFilterChips chips={buildChips(sp, locale)} />
      {clubs.length === 0 ? (
        <p className="italic text-[var(--canvas-dark-ink-muted)] py-8 text-center">
          No clubs match these filters. Try clearing one.
        </p>
      ) : (
        <>
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              alignItems: 'stretch',
            }}
          >
            {clubs.map((club) => (
              <ClubGridCard key={club.id} club={club} locale={locale} />
            ))}
          </div>
          <NumberedPagination
            tab="clubs"
            locale={locale}
            page={page}
            totalPages={totalPages}
            baseParams={{
              ...toggleBaseParams,
              mode: resolvedMode === 'trending' ? undefined : resolvedMode,
            }}
          />
        </>
      )}
    </div>
  )
}
