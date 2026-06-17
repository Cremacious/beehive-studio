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
  { value: 'small', label: 'Small (2–5)' },
  { value: 'mid', label: 'Medium (6–15)' },
  { value: 'large', label: 'Large (16+)' },
] as const
const OPEN_STATE_OPTIONS = [
  { value: 'looking-for-collaborators', label: 'Looking for collaborators' },
  { value: 'open-to-join', label: 'Open to join' },
] as const
const ACTIVITY_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: 'week', label: 'Active this week' },
] as const
const LINKED_OPTIONS = [
  { value: 'has-book', label: 'Has a linked book' },
  { value: 'standalone', label: 'Standalone hive' },
] as const

const GENRE_OPTIONS = GENRES.map((g) => ({ value: g, label: GENRE_LABEL[g] }))

function pickRaw(sp: SP, key: string): string | undefined {
  const v = sp[key]
  return typeof v === 'string' ? v : undefined
}

export function HivesFilters({ sp, locale }: Props) {
  const q = parseStringParam(pickRaw(sp, 'q'))
  const genres = parseMultiSelect(pickRaw(sp, 'genres'))
  const size = parseRadio(
    pickRaw(sp, 'size'),
    SIZE_OPTIONS.map((o) => o.value),
    'any',
  )
  const openStates = parseMultiSelect(pickRaw(sp, 'openStates'))
  const activity = parseRadio(
    pickRaw(sp, 'activity'),
    ACTIVITY_OPTIONS.map((o) => o.value),
    'any',
  )
  const linked = parseMultiSelect(pickRaw(sp, 'linked'))

  const activeCount =
    (genres.length > 0 ? 1 : 0) +
    (size !== 'any' ? 1 : 0) +
    (openStates.length > 0 ? 1 : 0) +
    (activity !== 'any' ? 1 : 0) +
    (linked.length > 0 ? 1 : 0)

  const modeParam = pickRaw(sp, 'mode')
  const clearHref =
    `/${locale}/discover?tab=hives` +
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
      <FilterSection label="Open state">
        <FilterCheckboxGroup
          name="openStates"
          options={OPEN_STATE_OPTIONS.map((o) => ({ ...o }))}
          selected={openStates}
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
      <FilterSection label="Linked">
        <FilterCheckboxGroup
          name="linked"
          options={LINKED_OPTIONS.map((o) => ({ ...o }))}
          selected={linked}
        />
      </FilterSection>
    </FilterSidebar>
  )
}
