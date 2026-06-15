import {
  searchHomeMixedAction,
  type EntityKind,
  type HomeMixedItem,
} from '@/lib/actions/discover-home-mixed.actions'
import {
  parseStringParam,
  parseMultiSelect,
  parseRadio,
  buildUrl,
} from '@/lib/discover/url-state'
import { GENRE_LABEL, isValidGenre, type GenreSlug } from '@/lib/discover/genres'
import { ActiveFilterChips, type ActiveFilterChip } from './active-filter-chips'
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
const FROM_LABEL = { anyone: 'Anyone', following: 'Following' } as const

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
  const from = parseRadio(pickRaw(sp, 'from'), ['anyone', 'following'], 'anyone')

  const all: Record<string, string | string[] | undefined> = {
    q,
    genres: genres.length ? genres : undefined,
    show: isShowNarrowed ? show : undefined,
    from: from !== 'anyone' ? from : undefined,
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
  if (from === 'following') {
    chips.push({ label: FROM_LABEL.following, removeHref: without('from') })
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
  const q = parseStringParam(pickRaw(sp, 'q'))
  const genres = parseMultiSelect(pickRaw(sp, 'genres'))
  const show = parseShow(sp)
  const from = parseRadio(pickRaw(sp, 'from'), ['anyone', 'following'], 'anyone')

  const res = await searchHomeMixedAction({
    q,
    show,
    genres,
    from,
  })
  const items = res.success ? res.data.items : []

  const chips = buildChips(sp, locale)

  return (
    <div className="flex flex-col gap-4">
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
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
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
