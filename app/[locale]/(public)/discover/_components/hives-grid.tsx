import {
  searchHivesDiscoverAction,
  getFeaturedHiveAction,
  type HiveCard,
  type SizeBucket,
} from '@/lib/actions/discover-hives.actions'
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
import { HiveGridCard } from './hive-grid-card'
import { NumberedPagination } from './numbered-pagination'

const PAGE_SIZE = 12

type SP = Record<string, string | string[] | undefined>
type Props = { sp: SP; locale: string }

const SIZES = ['any', 'small', 'mid', 'large'] as const
const ACTIVITIES = ['any', 'week'] as const
const SORTS = ['most-active', 'recent', 'most-members'] as const

const SIZE_LABEL: Record<(typeof SIZES)[number], string> = {
  any: 'Any size',
  small: 'Small',
  mid: 'Medium',
  large: 'Large',
}
const ACTIVITY_LABEL: Record<(typeof ACTIVITIES)[number], string> = {
  any: 'Any',
  week: 'Active this week',
}
const OPEN_STATE_LABEL: Record<string, string> = {
  'looking-for-collaborators': 'Looking for collaborators',
  'open-to-join': 'Open to join',
}
const LINKED_LABEL: Record<string, string> = {
  'has-book': 'Has linked book',
  standalone: 'Standalone',
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
  const openStates = parseMultiSelect(pickRaw(sp, 'openStates'))
  const activity = parseRadio(pickRaw(sp, 'activity'), ACTIVITIES, 'any')
  const linked = parseMultiSelect(pickRaw(sp, 'linked'))
  const sort = parseRadio(pickRaw(sp, 'sort'), SORTS, 'most-active')

  const all: Record<string, string | string[] | undefined> = {
    q,
    genres: genres.length ? genres : undefined,
    size: size !== 'any' ? size : undefined,
    openStates: openStates.length ? openStates : undefined,
    activity: activity !== 'any' ? activity : undefined,
    linked: linked.length ? linked : undefined,
    sort: sort !== 'most-active' ? sort : undefined,
  }
  const without = (key: string) =>
    buildUrl('hives', { ...all, [key]: undefined }, `/${locale}/discover`)
  const withoutMulti = (key: 'genres' | 'openStates' | 'linked', val: string) => {
    const current =
      key === 'genres' ? genres : key === 'openStates' ? openStates : linked
    const next = current.filter((v) => v !== val)
    return buildUrl(
      'hives',
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
  for (const s of openStates) {
    const label = OPEN_STATE_LABEL[s]
    if (label) chips.push({ label, removeHref: withoutMulti('openStates', s) })
  }
  if (activity !== 'any')
    chips.push({
      label: ACTIVITY_LABEL[activity],
      removeHref: without('activity'),
    })
  for (const l of linked) {
    const label = LINKED_LABEL[l]
    if (label) chips.push({ label, removeHref: withoutMulti('linked', l) })
  }
  return chips
}

export async function HivesGrid({ sp, locale }: Props) {
  const q = parseStringParam(pickRaw(sp, 'q'))
  const genres = parseMultiSelect(pickRaw(sp, 'genres'))
  const size = parseRadio(pickRaw(sp, 'size'), SIZES, 'any') as SizeBucket
  const openStates = parseMultiSelect(pickRaw(sp, 'openStates')) as Array<
    'looking-for-collaborators' | 'open-to-join'
  >
  const linked = parseMultiSelect(pickRaw(sp, 'linked')) as Array<
    'has-book' | 'standalone'
  >
  const sort = parseRadio(pickRaw(sp, 'sort'), SORTS, 'most-active')
  const page = Math.max(1, parseIntParam(pickRaw(sp, 'page'), 1))

  const [resultsRes, featuredRes] = await Promise.all([
    searchHivesDiscoverAction({
      q,
      genres,
      size,
      openStates,
      linked,
      sort,
      page,
    }),
    getFeaturedHiveAction({}),
  ])

  const hives: HiveCard[] = resultsRes.success ? resultsRes.data.books : []
  const totalCount: number = resultsRes.success ? resultsRes.data.totalCount : 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const featured =
    featuredRes.success && featuredRes.data
      ? {
          title: featuredRes.data.name,
          caption: `${featuredRes.data.memberCount} members`,
          href: `/${locale}/hive/${featuredRes.data.id}`,
        }
      : null

  return (
    <div className="flex flex-col gap-4">
      <SlimFeaturedStrip kind="hive" featured={featured} />
      <SortHeader
        count={totalCount}
        entityNoun={totalCount === 1 ? 'hive' : 'hives'}
        sortOptions={SORT_OPTIONS.map((o) => ({ ...o }))}
        selectedSort={sort}
      />
      <ActiveFilterChips chips={buildChips(sp, locale)} />
      {hives.length === 0 ? (
        <p className="italic text-[var(--canvas-dark-ink-muted)] py-8 text-center">
          No hives match these filters. Try clearing one.
        </p>
      ) : (
        <>
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              justifyItems: 'start',
            }}
          >
            {hives.map((hive) => (
              <HiveGridCard key={hive.id} hive={hive} locale={locale} />
            ))}
          </div>
          <NumberedPagination
            tab="hives"
            locale={locale}
            page={page}
            totalPages={totalPages}
            baseParams={{
              q,
              genres: genres.length ? genres : undefined,
              size: size !== 'any' ? size : undefined,
              openStates: openStates.length ? openStates : undefined,
              linked: linked.length ? linked : undefined,
              sort: sort !== 'most-active' ? sort : undefined,
            }}
          />
        </>
      )}
    </div>
  )
}
