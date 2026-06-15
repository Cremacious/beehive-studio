import { FilterSidebar } from './filter-sidebar'
import { FilterSection } from './filter-section'
import { FilterSearchInput } from './filter-search-input'
import { FilterCheckboxGroup } from './filter-checkbox-group'
import { FilterRadioGroup } from './filter-radio-group'
import {
  parseStringParam,
  parseMultiSelect,
  parseRadio,
} from '@/lib/discover/url-state'
import { GENRES, GENRE_LABEL } from '@/lib/discover/genres'

type SP = Record<string, string | string[] | undefined>
type Props = { sp: SP; locale: string }

const SHOW_OPTIONS = [
  { value: 'books', label: 'Books' },
  { value: 'sparks', label: 'Sparks' },
  { value: 'hives', label: 'Hives' },
  { value: 'lists', label: 'Lists' },
  { value: 'clubs', label: 'Clubs' },
] as const
const FROM_OPTIONS = [
  { value: 'anyone', label: 'Anyone' },
  { value: 'following', label: 'Following' },
] as const

const GENRE_OPTIONS = GENRES.map((g) => ({ value: g, label: GENRE_LABEL[g] }))

function pickRaw(sp: SP, key: string): string | undefined {
  const v = sp[key]
  return typeof v === 'string' ? v : undefined
}

const ALL_SHOW = SHOW_OPTIONS.map((o) => o.value)

export function HomeFilters({ sp, locale }: Props) {
  const q = parseStringParam(pickRaw(sp, 'q'))
  const genres = parseMultiSelect(pickRaw(sp, 'genres'))
  const showRaw = parseMultiSelect(pickRaw(sp, 'show'))
  // When show is empty in the URL, all 5 entities are checked by default.
  const show = showRaw.length === 0 ? ALL_SHOW.slice() : showRaw
  const from = parseRadio(
    pickRaw(sp, 'from'),
    FROM_OPTIONS.map((o) => o.value),
    'anyone',
  )

  // Show is "active" only when at least one entity is excluded.
  const isShowNarrowed = show.length < 5

  const activeCount =
    (q ? 1 : 0) +
    (isShowNarrowed ? 1 : 0) +
    (genres.length > 0 ? 1 : 0) +
    (from !== 'anyone' ? 1 : 0)

  return (
    <FilterSidebar
      activeCount={activeCount}
      clearHref={`/${locale}/discover?tab=home`}
    >
      <FilterSection label="Search" defaultOpen>
        <FilterSearchInput
          name="q"
          placeholder="Anything…"
          initialValue={q ?? ''}
        />
      </FilterSection>
      <FilterSection label="Show">
        <FilterCheckboxGroup
          name="show"
          options={SHOW_OPTIONS.map((o) => ({ ...o }))}
          selected={show}
        />
      </FilterSection>
      <FilterSection label="Genre">
        <FilterCheckboxGroup
          name="genres"
          options={GENRE_OPTIONS}
          selected={genres}
        />
      </FilterSection>
      <FilterSection label="From">
        <FilterRadioGroup
          name="from"
          options={FROM_OPTIONS.map((o) => ({ ...o }))}
          selected={from}
          fallback="anyone"
        />
      </FilterSection>
    </FilterSidebar>
  )
}
