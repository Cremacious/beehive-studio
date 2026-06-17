import { FilterSidebar } from './filter-sidebar'
import { FilterSection } from './filter-section'
import { FilterCheckboxGroup } from './filter-checkbox-group'
import {
  parseStringParam,
  parseMultiSelect,
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

  // Show is "active" only when at least one entity is excluded.
  const isShowNarrowed = show.length < 5

  const activeCount =
    (isShowNarrowed ? 1 : 0) +
    (genres.length > 0 ? 1 : 0)

  const modeParam = pickRaw(sp, 'mode')
  const clearHref =
    `/${locale}/discover?tab=home` +
    (modeParam ? `&mode=${encodeURIComponent(modeParam)}` : '') +
    (q ? `&q=${encodeURIComponent(q)}` : '')

  return (
    <FilterSidebar
      activeCount={activeCount}
      clearHref={clearHref}
    >
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
    </FilterSidebar>
  )
}
