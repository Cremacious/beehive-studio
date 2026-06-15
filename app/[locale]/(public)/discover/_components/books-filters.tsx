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

type Props = {
  sp: SP
  locale: string
}

const LENGTH_OPTIONS = [
  { value: 'any', label: 'Any length' },
  { value: 'short', label: 'Short (<20k)' },
  { value: 'novella', label: 'Novella (20–50k)' },
  { value: 'novel', label: 'Novel (50–120k)' },
  { value: 'epic', label: 'Epic (120k+)' },
] as const

const STATUS_OPTIONS = [
  { value: 'any', label: 'Any status' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
] as const

const SERIES_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: 'standalone', label: 'Standalone only' },
  { value: 'in-series', label: 'Part of a series' },
] as const

const UPDATED_OPTIONS = [
  { value: 'anytime', label: 'Anytime' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
] as const

const GENRE_OPTIONS = GENRES.map((g) => ({ value: g, label: GENRE_LABEL[g] }))

function pickRaw(sp: SP, key: string): string | undefined {
  const v = sp[key]
  return typeof v === 'string' ? v : undefined
}

export function BooksFilters({ sp, locale }: Props) {
  const q = parseStringParam(pickRaw(sp, 'q'))
  const genres = parseMultiSelect(pickRaw(sp, 'genres'))
  const length = parseRadio(
    pickRaw(sp, 'length'),
    LENGTH_OPTIONS.map((o) => o.value),
    'any',
  )
  const status = parseRadio(
    pickRaw(sp, 'status'),
    STATUS_OPTIONS.map((o) => o.value),
    'any',
  )
  const series = parseRadio(
    pickRaw(sp, 'series'),
    SERIES_OPTIONS.map((o) => o.value),
    'any',
  )
  const updated = parseRadio(
    pickRaw(sp, 'updated'),
    UPDATED_OPTIONS.map((o) => o.value),
    'anytime',
  )

  const activeCount =
    (q ? 1 : 0) +
    (genres.length > 0 ? 1 : 0) +
    (length !== 'any' ? 1 : 0) +
    (status !== 'any' ? 1 : 0) +
    (series !== 'any' ? 1 : 0) +
    (updated !== 'anytime' ? 1 : 0)

  const mode = pickRaw(sp, 'mode')
  const clearHref =
    `/${locale}/discover?tab=books` +
    (mode ? `&mode=${encodeURIComponent(mode)}` : '')

  return (
    <FilterSidebar activeCount={activeCount} clearHref={clearHref}>
      <FilterSection label="Search" defaultOpen>
        <FilterSearchInput
          name="q"
          placeholder="Title, author, tag…"
          initialValue={q ?? ''}
        />
      </FilterSection>

      <FilterSection label="Genre">
        <FilterCheckboxGroup
          name="genres"
          options={GENRE_OPTIONS}
          selected={genres}
        />
      </FilterSection>

      <FilterSection label="Length">
        <FilterRadioGroup
          name="length"
          options={LENGTH_OPTIONS.map((o) => ({ ...o }))}
          selected={length}
          fallback="any"
        />
      </FilterSection>

      <FilterSection label="Status">
        <FilterRadioGroup
          name="status"
          options={STATUS_OPTIONS.map((o) => ({ ...o }))}
          selected={status}
          fallback="any"
        />
      </FilterSection>

      <FilterSection label="Series">
        <FilterRadioGroup
          name="series"
          options={SERIES_OPTIONS.map((o) => ({ ...o }))}
          selected={series}
          fallback="any"
        />
      </FilterSection>

      <FilterSection label="Updated">
        <FilterRadioGroup
          name="updated"
          options={UPDATED_OPTIONS.map((o) => ({ ...o }))}
          selected={updated}
          fallback="anytime"
        />
      </FilterSection>
    </FilterSidebar>
  )
}
