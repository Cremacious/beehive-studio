import {
  searchSparksDiscoverAction,
  getFeaturedSparkAction,
  type SparkCard,
} from '@/lib/actions/discover-sparks.actions'
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
import { SparkGridCard } from './spark-grid-card'
import { NumberedPagination } from './numbered-pagination'

const PAGE_SIZE = 12

type SP = Record<string, string | string[] | undefined>
type Props = { sp: SP; locale: string }

const STATES = ['all', 'live', 'voting', 'ended'] as const
const WORD_LIMITS = ['any', 'flash', 'medium', 'long'] as const
const TIME_LEFTS = ['any', '24h', 'week'] as const
const CREATORS = ['anyone', 'following'] as const
const SORTS = ['urgent', 'recent', 'most-entered'] as const

const STATE_LABEL: Record<(typeof STATES)[number], string> = {
  all: 'Any state',
  live: 'Live',
  voting: 'Voting',
  ended: 'Ended',
}
const WORD_LIMIT_LABEL: Record<(typeof WORD_LIMITS)[number], string> = {
  any: 'Any limit',
  flash: 'Flash (<500)',
  medium: '500–2000',
  long: '2000+',
}
const TIME_LEFT_LABEL: Record<(typeof TIME_LEFTS)[number], string> = {
  any: 'Any',
  '24h': 'Less than 24h',
  week: 'This week',
}
const CREATOR_LABEL: Record<(typeof CREATORS)[number], string> = {
  anyone: 'Anyone',
  following: 'Following',
}

const SORT_OPTIONS = [
  { value: 'urgent', label: 'Ending soon' },
  { value: 'recent', label: 'Most recent' },
  { value: 'most-entered', label: 'Most entries' },
] as const

function pickRaw(sp: SP, key: string): string | undefined {
  const v = sp[key]
  return typeof v === 'string' ? v : undefined
}

function buildChips(sp: SP, locale: string): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = []
  const q = parseStringParam(pickRaw(sp, 'q'))
  const genres = parseMultiSelect(pickRaw(sp, 'genres'))
  const state = parseRadio(pickRaw(sp, 'state'), STATES, 'all')
  const wordLimit = parseRadio(pickRaw(sp, 'wordLimit'), WORD_LIMITS, 'any')
  const timeLeft = parseRadio(pickRaw(sp, 'timeLeft'), TIME_LEFTS, 'any')
  const creator = parseRadio(pickRaw(sp, 'creator'), CREATORS, 'anyone')
  const sort = parseRadio(pickRaw(sp, 'sort'), SORTS, 'urgent')

  const all: Record<string, string | string[] | undefined> = {
    q,
    genres: genres.length ? genres : undefined,
    state: state !== 'all' ? state : undefined,
    wordLimit: wordLimit !== 'any' ? wordLimit : undefined,
    timeLeft: timeLeft !== 'any' ? timeLeft : undefined,
    creator: creator !== 'anyone' ? creator : undefined,
    sort: sort !== 'urgent' ? sort : undefined,
  }
  const without = (key: string) =>
    buildUrl('sparks', { ...all, [key]: undefined }, `/${locale}/discover`)
  const withoutGenre = (slug: string) => {
    const next = genres.filter((g) => g !== slug)
    return buildUrl(
      'sparks',
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
  if (state !== 'all')
    chips.push({ label: STATE_LABEL[state], removeHref: without('state') })
  if (wordLimit !== 'any')
    chips.push({
      label: WORD_LIMIT_LABEL[wordLimit],
      removeHref: without('wordLimit'),
    })
  if (timeLeft !== 'any')
    chips.push({
      label: TIME_LEFT_LABEL[timeLeft],
      removeHref: without('timeLeft'),
    })
  if (creator !== 'anyone')
    chips.push({
      label: CREATOR_LABEL[creator],
      removeHref: without('creator'),
    })
  return chips
}

export async function SparksGrid({ sp, locale }: Props) {
  const q = parseStringParam(pickRaw(sp, 'q'))
  const genres = parseMultiSelect(pickRaw(sp, 'genres'))
  const state = parseRadio(pickRaw(sp, 'state'), STATES, 'all')
  const wordLimit = parseRadio(pickRaw(sp, 'wordLimit'), WORD_LIMITS, 'any')
  const timeLeft = parseRadio(pickRaw(sp, 'timeLeft'), TIME_LEFTS, 'any')
  const creator = parseRadio(pickRaw(sp, 'creator'), CREATORS, 'anyone')
  const sort = parseRadio(pickRaw(sp, 'sort'), SORTS, 'urgent')
  const page = Math.max(1, parseIntParam(pickRaw(sp, 'page'), 1))

  const [resultsRes, featuredRes] = await Promise.all([
    searchSparksDiscoverAction({
      q,
      genres,
      state,
      wordLimit,
      timeLeft,
      creator,
      sort,
      page,
    }),
    getFeaturedSparkAction({}),
  ])

  const sparks: SparkCard[] = resultsRes.success ? resultsRes.data.books : []
  const totalCount: number = resultsRes.success ? resultsRes.data.totalCount : 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const featured =
    featuredRes.success && featuredRes.data
      ? {
          title: featuredRes.data.title,
          caption: featuredRes.data.creatorUsername
            ? `by @${featuredRes.data.creatorUsername}`
            : 'Live now',
          href: `/${locale}/sparks/${featuredRes.data.id}`,
        }
      : null

  return (
    <div className="flex flex-col gap-4">
      <SlimFeaturedStrip kind="spark" featured={featured} />
      <SortHeader
        count={totalCount}
        entityNoun={totalCount === 1 ? 'spark' : 'sparks'}
        sortOptions={SORT_OPTIONS.map((o) => ({ ...o }))}
        selectedSort={sort}
      />
      <ActiveFilterChips chips={buildChips(sp, locale)} />
      {sparks.length === 0 ? (
        <p className="italic text-[var(--canvas-dark-ink-muted)] py-8 text-center">
          No sparks match these filters. Try clearing one.
        </p>
      ) : (
        <>
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              alignItems: 'stretch',
            }}
          >
            {sparks.map((spark) => (
              <SparkGridCard key={spark.id} spark={spark} locale={locale} />
            ))}
          </div>
          <NumberedPagination
            tab="sparks"
            locale={locale}
            page={page}
            totalPages={totalPages}
            baseParams={{
              q,
              genres: genres.length ? genres : undefined,
              state: state !== 'all' ? state : undefined,
              wordLimit: wordLimit !== 'any' ? wordLimit : undefined,
              timeLeft: timeLeft !== 'any' ? timeLeft : undefined,
              creator: creator !== 'anyone' ? creator : undefined,
              sort: sort !== 'urgent' ? sort : undefined,
            }}
          />
        </>
      )}
    </div>
  )
}
