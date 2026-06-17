import {
  searchHomeMixedAction,
  type EntityKind,
  type HomeMixedItem,
} from '@/lib/actions/discover-home-mixed.actions'
import {
  parseStringParam,
  parseMultiSelect,
  buildUrl,
  parseMode,
  type ModeId,
} from '@/lib/discover/url-state'
import { resolveDefaultMode } from '@/lib/discover/resolve-default-mode'
import { getOptionalUserId } from '@/lib/require-auth'
import { hasAnyDiscoverySignalAction } from '@/lib/actions/discover-for-you-books.actions'
import { GENRE_LABEL, isValidGenre, type GenreSlug } from '@/lib/discover/genres'
import { ActiveFilterChips, type ActiveFilterChip } from './active-filter-chips'
import { DiscoveryModeToggle } from './discovery-mode-toggle'
import { FilterSearchInput } from './filter-search-input'
import { BookGridCard } from './book-grid-card'
import { SparkGridCard } from './spark-grid-card'
import { HiveGridCard } from './hive-grid-card'
import { ListGridCard } from './list-grid-card'
import { ClubGridCard } from './club-grid-card'

type SP = Record<string, string | string[] | undefined>
type Props = { sp: SP; locale: string }

const ALL_SHOW: EntityKind[] = ['books', 'sparks', 'hives', 'lists', 'clubs']
const SHOW_LABEL: Record<EntityKind, string> = {
  books: 'Books',
  sparks: 'Sparks',
  hives: 'Hives',
  lists: 'Lists',
  clubs: 'Clubs',
}

function pickRaw(sp: SP, key: string): string | undefined {
  const v = sp[key]
  return typeof v === 'string' ? v : undefined
}

function parseShow(sp: SP): EntityKind[] {
  const raw = parseMultiSelect(pickRaw(sp, 'show'))
  if (raw.length === 0) return ALL_SHOW.slice()
  return raw.filter((s): s is EntityKind =>
    (ALL_SHOW as string[]).includes(s),
  )
}

function buildChips(sp: SP, locale: string): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = []
  const q = parseStringParam(pickRaw(sp, 'q'))
  const genres = parseMultiSelect(pickRaw(sp, 'genres'))
  const show = parseShow(sp)
  const isShowNarrowed = show.length < 5
  const modeRaw = pickRaw(sp, 'mode')

  const all: Record<string, string | string[] | undefined> = {
    q,
    genres: genres.length ? genres : undefined,
    show: isShowNarrowed ? show : undefined,
    mode: modeRaw,
  }
  const without = (key: string) =>
    buildUrl('home', { ...all, [key]: undefined }, `/${locale}/discover`)
  const withoutGenre = (slug: string) => {
    const next = genres.filter((g) => g !== slug)
    return buildUrl(
      'home',
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
  if (isShowNarrowed) {
    chips.push({
      label: `Show: ${show.map((s) => SHOW_LABEL[s]).join(', ')}`,
      removeHref: without('show'),
    })
  }
  return chips
}

function renderItem(item: HomeMixedItem, locale: string) {
  switch (item.kind) {
    case 'book':
      return <BookGridCard book={item.data} locale={locale} />
    case 'spark':
      return <SparkGridCard spark={item.data} locale={locale} />
    case 'hive':
      return <HiveGridCard hive={item.data} locale={locale} />
    case 'list':
      return <ListGridCard list={item.data} locale={locale} />
    case 'club':
      return <ClubGridCard club={item.data} locale={locale} />
  }
}

function itemKey(item: HomeMixedItem): string {
  return `${item.kind}:${item.data.id}`
}

export async function HomeGrid({ sp, locale }: Props) {
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
  const show = parseShow(sp)

  // Derive `from` from the resolved mode rather than from URL params.
  const from = resolvedMode === 'for-you' ? 'following' : 'anyone'

  const res = await searchHomeMixedAction({
    q,
    show,
    genres,
    from,
  })
  const items = res.success ? res.data.items : []

  const chips = buildChips(sp, locale)

  // baseParams for DiscoveryModeToggle (no mode, no from, no sort, no page).
  const toggleBaseParams: Record<string, string | string[] | undefined> = {
    q,
    genres: genres.length ? genres : undefined,
    show: show.length < 5 ? show : undefined,
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
        <FilterSearchInput name="q" placeholder="Anything…" initialValue={q ?? ''} variant="hero" />
        <DiscoveryModeToggle
          tab="home"
          locale={locale}
          current={resolvedMode}
          isAuthed={isAuthed}
          baseParams={toggleBaseParams}
        />
      </div>
      <div className="text-[12px] text-[var(--canvas-dark-ink-muted)]">
        <strong className="text-[var(--canvas-dark-ink)]">
          {items.length.toLocaleString()}
        </strong>{' '}
        results across your selected entities
      </div>
      <ActiveFilterChips chips={chips} />
      {items.length === 0 ? (
        <p className="italic text-[var(--canvas-dark-ink-muted)] py-8 text-center">
          Nothing to show yet. Try unchecking fewer entities or clearing filters.
        </p>
      ) : (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            justifyItems: 'start',
          }}
        >
          {items.map((item) => (
            <div key={itemKey(item)}>{renderItem(item, locale)}</div>
          ))}
        </div>
      )}
    </div>
  )
}
