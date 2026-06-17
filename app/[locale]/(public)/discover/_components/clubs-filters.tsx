import { FilterSidebar } from './filter-sidebar'
import { FilterSection } from './filter-section'
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

const SIZE_OPTIONS = [
  { value: 'any', label: 'Any size' },
  { value: 'intimate', label: 'Intimate (2–5)' },
  { value: 'mid', label: 'Medium (6–15)' },
  { value: 'large', label: 'Large (16+)' },
] as const
const ACCESS_OPTIONS = [
  { value: 'open', label: 'Open to join' },
  { value: 'approval', label: 'Approval required' },
] as const
const ACTIVITY_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: 'week', label: 'Active this week' },
] as const
const CURRENT_BOOK_OPTIONS = [
  { value: 'has-current', label: 'Has a current read' },
  { value: 'between', label: 'Between books' },
] as const

const GENRE_OPTIONS = GENRES.map((g) => ({ value: g, label: GENRE_LABEL[g] }))

function pickRaw(sp: SP, key: string): string | undefined {
  const v = sp[key]
  return typeof v === 'string' ? v : undefined
}

export function ClubsFilters({ sp, locale }: Props) {
  const q = parseStringParam(pickRaw(sp, 'q'))
  const genres = parseMultiSelect(pickRaw(sp, 'genres'))
  const size = parseRadio(
    pickRaw(sp, 'size'),
    SIZE_OPTIONS.map((o) => o.value),
    'any',
  )
  const access = parseMultiSelect(pickRaw(sp, 'accessStates'))
  const activity = parseRadio(
    pickRaw(sp, 'activity'),
    ACTIVITY_OPTIONS.map((o) => o.value),
    'any',
  )
  const currentBook = parseMultiSelect(pickRaw(sp, 'currentBook'))

  const modeParam = pickRaw(sp, 'mode')
  const activeCount =
    (genres.length > 0 ? 1 : 0) +
    (size !== 'any' ? 1 : 0) +
    (access.length > 0 ? 1 : 0) +
    (activity !== 'any' ? 1 : 0) +
    (currentBook.length > 0 ? 1 : 0)

  const clearHref =
    `/${locale}/discover?tab=clubs` +
    (modeParam ? `&mode=${encodeURIComponent(modeParam)}` : '') +
    (q ? `&q=${encodeURIComponent(q)}` : '')

  return (
    <FilterSidebar activeCount={activeCount} clearHref={clearHref}>
      <FilterSection label="Genre">
        <FilterCheckboxGroup
          name="genres"
          options={GENRE_OPTIONS}
          selected={genres}
        />
      </FilterSection>
      <FilterSection label="Size">
        <FilterRadioGroup
          name="size"
          options={SIZE_OPTIONS.map((o) => ({ ...o }))}
          selected={size}
          fallback="any"
        />
      </FilterSection>
      <FilterSection label="Access">
        <FilterCheckboxGroup
          name="accessStates"
          options={ACCESS_OPTIONS.map((o) => ({ ...o }))}
          selected={access}
        />
      </FilterSection>
      <FilterSection label="Activity">
        <FilterRadioGroup
          name="activity"
          options={ACTIVITY_OPTIONS.map((o) => ({ ...o }))}
          selected={activity}
          fallback="any"
        />
      </FilterSection>
      <FilterSection label="Current book">
        <FilterCheckboxGroup
          name="currentBook"
          options={CURRENT_BOOK_OPTIONS.map((o) => ({ ...o }))}
          selected={currentBook}
        />
      </FilterSection>
    </FilterSidebar>
  )
}
