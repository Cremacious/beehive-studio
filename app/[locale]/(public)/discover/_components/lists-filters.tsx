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
  { value: 'small', label: 'Small (1–5 books)' },
  { value: 'mid', label: 'Medium (6–20)' },
  { value: 'large', label: 'Large (20+)' },
] as const
const POPULARITY_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: '10+', label: '10+ followers' },
] as const
const UPDATED_OPTIONS = [
  { value: 'anytime', label: 'Anytime' },
  { value: 'month', label: 'This month' },
] as const
const CURATOR_OPTIONS = [
  { value: 'anyone', label: 'Anyone' },
  { value: 'following', label: 'Following' },
] as const

const GENRE_OPTIONS = GENRES.map((g) => ({ value: g, label: GENRE_LABEL[g] }))

function pickRaw(sp: SP, key: string): string | undefined {
  const v = sp[key]
  return typeof v === 'string' ? v : undefined
}

export function ListsFilters({ sp, locale }: Props) {
  const q = parseStringParam(pickRaw(sp, 'q'))
  const genres = parseMultiSelect(pickRaw(sp, 'genres'))
  const size = parseRadio(
    pickRaw(sp, 'size'),
    SIZE_OPTIONS.map((o) => o.value),
    'any',
  )
  const popularity = parseRadio(
    pickRaw(sp, 'popularity'),
    POPULARITY_OPTIONS.map((o) => o.value),
    'any',
  )
  const updated = parseRadio(
    pickRaw(sp, 'updated'),
    UPDATED_OPTIONS.map((o) => o.value),
    'anytime',
  )
  const curator = parseRadio(
    pickRaw(sp, 'curator'),
    CURATOR_OPTIONS.map((o) => o.value),
    'anyone',
  )

  const activeCount =
    (genres.length > 0 ? 1 : 0) +
    (size !== 'any' ? 1 : 0) +
    (popularity !== 'any' ? 1 : 0) +
    (updated !== 'anytime' ? 1 : 0) +
    (curator !== 'anyone' ? 1 : 0)

  const modeParam = pickRaw(sp, 'mode')
  const clearHref =
    `/${locale}/discover?tab=lists` +
    (modeParam ? `&mode=${encodeURIComponent(modeParam)}` : '') +
    (q ? `&q=${encodeURIComponent(q)}` : '')

  return (
    <FilterSidebar
      activeCount={activeCount}
      clearHref={clearHref}
    >
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
      <FilterSection label="Popularity">
        <FilterRadioGroup
          name="popularity"
          options={POPULARITY_OPTIONS.map((o) => ({ ...o }))}
          selected={popularity}
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
      <FilterSection label="Curator">
        <FilterRadioGroup
          name="curator"
          options={CURATOR_OPTIONS.map((o) => ({ ...o }))}
          selected={curator}
          fallback="anyone"
        />
      </FilterSection>
    </FilterSidebar>
  )
}
