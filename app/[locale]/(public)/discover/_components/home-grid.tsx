import Link from 'next/link'
import { BookOpen, Zap, Hexagon, List, Users } from 'lucide-react'
import {
  searchBooksDiscoverAction,
  type BookCard,
} from '@/lib/actions/discover.actions'
import {
  searchSparksDiscoverAction,
  type SparkCard,
} from '@/lib/actions/discover-sparks.actions'
import {
  searchHivesDiscoverAction,
  type HiveCard,
} from '@/lib/actions/discover-hives.actions'
import {
  searchListsDiscoverAction,
  type ListCard,
} from '@/lib/actions/discover-lists.actions'
import {
  searchClubsDiscoverAction,
  type ClubCard,
} from '@/lib/actions/discover-clubs.actions'
import {
  type EntityKind,
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

const PER_SECTION = 6

const ALL_SHOW: EntityKind[] = ['books', 'sparks', 'hives', 'lists', 'clubs']
const SHOW_LABEL: Record<EntityKind, string> = {
  books: 'Books',
  sparks: 'Sparks',
  hives: 'Hives',
  lists: 'Lists',
  clubs: 'Clubs',
}

// Fluid cards need a fixed outer width so they render consistently in a flex
// row. Fixed-width cards carry their own width — pass null to skip the wrapper.
// HiveGridCard: w-[280px] internal. ClubGridCard: width:340 internal.
const SECTION_CARD_WIDTH: Record<EntityKind, number | null> = {
  books:  200,
  sparks: 260,
  hives:  null,
  lists:  280,
  clubs:  null,
}

const ENTITY_ICON: Record<EntityKind, React.ReactNode> = {
  books:  <BookOpen size={14} />,
  sparks: <Zap size={14} />,
  hives:  <Hexagon size={14} />,
  lists:  <List size={14} />,
  clubs:  <Users size={14} />,
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

type SectionData =
  | { kind: 'books';  items: BookCard[]  }
  | { kind: 'sparks'; items: SparkCard[] }
  | { kind: 'hives';  items: HiveCard[]  }
  | { kind: 'lists';  items: ListCard[]  }
  | { kind: 'clubs';  items: ClubCard[]  }

function EntitySection({
  section,
  locale,
}: {
  section: SectionData
  locale: string
}) {
  const { kind } = section
  const seeAllHref = `/${locale}/discover?tab=${kind}`
  const label = SHOW_LABEL[kind]
  const cardWidth = SECTION_CARD_WIDTH[kind]

  return (
    <div className="flex flex-col gap-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div
          className="flex items-center gap-2"
          style={{ color: 'var(--canvas-dark-ink-strong)' }}
        >
          <span style={{ color: 'var(--canvas-dark-ink-muted)' }}>
            {ENTITY_ICON[kind]}
          </span>
          <span
            className="text-[13px] font-bold"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {label}
          </span>
          <span
            className="text-[11px]"
            style={{
              color: 'var(--canvas-dark-ink-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {section.items.length}
          </span>
        </div>
        <Link
          href={seeAllHref}
          className="text-[11px] no-underline hover:underline"
          style={{
            color: 'var(--brand)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          See all {label.toLowerCase()} →
        </Link>
      </div>

      {/* Card row — overflow:hidden clips cards that don't fit the viewport */}
      <div className="flex gap-3 overflow-hidden">
        {section.kind === 'books' && section.items.map((book) => (
          <div key={book.id} style={{ width: cardWidth!, flexShrink: 0 }}>
            <BookGridCard book={book} locale={locale} />
          </div>
        ))}
        {section.kind === 'sparks' && section.items.map((spark) => (
          <div key={spark.id} style={{ width: cardWidth!, flexShrink: 0 }}>
            <SparkGridCard spark={spark} locale={locale} />
          </div>
        ))}
        {section.kind === 'hives' && section.items.map((hive) => (
          // HiveGridCard carries its own w-[280px] — no wrapper width needed
          <HiveGridCard key={hive.id} hive={hive} locale={locale} />
        ))}
        {section.kind === 'lists' && section.items.map((list) => (
          <div key={list.id} style={{ width: cardWidth!, flexShrink: 0 }}>
            <ListGridCard list={list} locale={locale} />
          </div>
        ))}
        {section.kind === 'clubs' && section.items.map((club) => (
          // ClubGridCard carries its own width:340 — no wrapper width needed
          <ClubGridCard key={club.id} club={club} locale={locale} />
        ))}
      </div>
    </div>
  )
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
  // Tags only meaningfully filter the lists section — applied below.
  const tags = parseMultiSelect(pickRaw(sp, 'tags')).map((t) =>
    t.toLowerCase(),
  )
  const show = parseShow(sp)

  // For books, "For You" mode surfaces followed-author content first.
  // Sparks, hives, lists, clubs always use their natural sort so their
  // sections are never empty due to a follow-graph filter.
  const bookSort = resolvedMode === 'for-you' ? 'recent' : 'popular'
  const sharedArgs = {
    q,
    genres: genres.length ? genres : undefined,
  }

  const [booksRes, sparksRes, hivesRes, listsRes, clubsRes] = await Promise.all([
    show.includes('books')
      ? searchBooksDiscoverAction({ ...sharedArgs, sort: bookSort })
      : null,
    show.includes('sparks')
      ? searchSparksDiscoverAction({ ...sharedArgs, sort: 'urgent' })
      : null,
    show.includes('hives')
      ? searchHivesDiscoverAction({ ...sharedArgs, sort: 'most-active' })
      : null,
    show.includes('lists')
      ? searchListsDiscoverAction({
          ...sharedArgs,
          tags: tags.length > 0 ? tags : undefined,
          sort: 'most-followed',
        })
      : null,
    show.includes('clubs')
      ? searchClubsDiscoverAction({ ...sharedArgs, sort: 'most-active' })
      : null,
  ])

  const sections: SectionData[] = []

  if (booksRes?.success && booksRes.data.books.length > 0)
    sections.push({ kind: 'books',  items: booksRes.data.books.slice(0, PER_SECTION) })
  if (sparksRes?.success && sparksRes.data.books.length > 0)
    sections.push({ kind: 'sparks', items: sparksRes.data.books.slice(0, PER_SECTION) })
  if (hivesRes?.success && hivesRes.data.books.length > 0)
    sections.push({ kind: 'hives',  items: hivesRes.data.books.slice(0, PER_SECTION) })
  if (listsRes?.success && listsRes.data.books.length > 0)
    sections.push({ kind: 'lists',  items: listsRes.data.books.slice(0, PER_SECTION) })
  if (clubsRes?.success && clubsRes.data.books.length > 0)
    sections.push({ kind: 'clubs',  items: clubsRes.data.books.slice(0, PER_SECTION) })

  const totalCount = sections.reduce((n, s) => n + s.items.length, 0)

  const chips = buildChips(sp, locale)

  const toggleBaseParams: Record<string, string | string[] | undefined> = {
    q,
    genres: genres.length ? genres : undefined,
    show: show.length < 5 ? show : undefined,
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Hero panel — search + mode toggle. Do not modify. */}
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

      <ActiveFilterChips chips={chips} />

      {sections.length === 0 ? (
        <p className="italic text-[var(--canvas-dark-ink-muted)] py-8 text-center">
          Nothing to show yet. Try unchecking fewer entities or clearing filters.
        </p>
      ) : (
        <>
          <div className="text-[12px] text-[var(--canvas-dark-ink-muted)]">
            <strong className="text-[var(--canvas-dark-ink)]">
              {totalCount.toLocaleString()}
            </strong>{' '}
            results across your selected entities
          </div>
          <div className="flex flex-col gap-8">
            {sections.map((section) => (
              <EntitySection
                key={section.kind}
                section={section}
                locale={locale}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
