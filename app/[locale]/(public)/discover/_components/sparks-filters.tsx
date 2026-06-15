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

const STATE_OPTIONS = [
  { value: 'all', label: 'Any state' },
  { value: 'live', label: 'Live (accepting)' },
  { value: 'voting', label: 'Voting open' },
  { value: 'ended', label: 'Ended' },
] as const
const WORD_LIMIT_OPTIONS = [
  { value: 'any', label: 'Any limit' },
  { value: 'flash', label: 'Flash (<500)' },
  { value: 'medium', label: '500–2000' },
  { value: 'long', label: '2000+' },
] as const
const TIME_LEFT_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: '24h', label: 'Less than 24h' },
  { value: 'week', label: 'This week' },
] as const
const CREATOR_OPTIONS = [
  { value: 'anyone', label: 'Anyone' },
  { value: 'following', label: 'Following' },
] as const

const GENRE_OPTIONS = GENRES.map((g) => ({ value: g, label: GENRE_LABEL[g] }))

function pickRaw(sp: SP, key: string): string | undefined {
  const v = sp[key]
  return typeof v === 'string' ? v : undefined
}

export function SparksFilters({ sp, locale }: Props) {
  const q = parseStringParam(pickRaw(sp, 'q'))
  const genres = parseMultiSelect(pickRaw(sp, 'genres'))
  const state = parseRadio(
    pickRaw(sp, 'state'),
    STATE_OPTIONS.map((o) => o.value),
    'all',
  )
  const wordLimit = parseRadio(
    pickRaw(sp, 'wordLimit'),
    WORD_LIMIT_OPTIONS.map((o) => o.value),
    'any',
  )
  const timeLeft = parseRadio(
    pickRaw(sp, 'timeLeft'),
    TIME_LEFT_OPTIONS.map((o) => o.value),
    'any',
  )
  const creator = parseRadio(
    pickRaw(sp, 'creator'),
    CREATOR_OPTIONS.map((o) => o.value),
    'anyone',
  )

  const activeCount =
    (q ? 1 : 0) +
    (genres.length > 0 ? 1 : 0) +
    (state !== 'all' ? 1 : 0) +
    (wordLimit !== 'any' ? 1 : 0) +
    (timeLeft !== 'any' ? 1 : 0) +
    (creator !== 'anyone' ? 1 : 0)

  return (
    <FilterSidebar
      activeCount={activeCount}
      clearHref={`/${locale}/discover?tab=sparks`}
    >
      <FilterSection label="Search" defaultOpen>
        <FilterSearchInput
          name="q"
          placeholder="Prompt, creator…"
          initialValue={q ?? ''}
        />
      </FilterSection>
      <FilterSection label="State">
        <FilterRadioGroup
          name="state"
          options={STATE_OPTIONS.map((o) => ({ ...o }))}
          selected={state}
          fallback="all"
        />
      </FilterSection>
      <FilterSection label="Word limit">
        <FilterRadioGroup
          name="wordLimit"
          options={WORD_LIMIT_OPTIONS.map((o) => ({ ...o }))}
          selected={wordLimit}
          fallback="any"
        />
      </FilterSection>
      <FilterSection label="Genre">
        <FilterCheckboxGroup
          name="genres"
          options={GENRE_OPTIONS}
          selected={genres}
        />
      </FilterSection>
      <FilterSection label="Time left">
        <FilterRadioGroup
          name="timeLeft"
          options={TIME_LEFT_OPTIONS.map((o) => ({ ...o }))}
          selected={timeLeft}
          fallback="any"
        />
      </FilterSection>
      <FilterSection label="Creator">
        <FilterRadioGroup
          name="creator"
          options={CREATOR_OPTIONS.map((o) => ({ ...o }))}
          selected={creator}
          fallback="anyone"
        />
      </FilterSection>
    </FilterSidebar>
  )
}
