'use client'
import { FilterDropdown } from '@/app/[locale]/(public)/discover/_components/filter-dropdown'

const SORT_OPTIONS = [
  { value: 'active', label: 'Most active' },
  { value: 'newest', label: 'Newest' },
  { value: 'a-z', label: 'A→Z' },
  { value: 'members', label: 'Member count' },
] as const

export type ClubsSort = 'active' | 'newest' | 'a-z' | 'members'

type Props = {
  selected: ClubsSort
}

/**
 * Thin client wrapper around <FilterDropdown> for the /clubs hub's
 * header sort control. FilterDropdown handles URL state via useFilterNav
 * (writes `?sort=X` and drops the param when value equals the fallback
 * `'active'`).
 */
export function ClubsSortDropdown({ selected }: Props) {
  return (
    <FilterDropdown
      name="sort"
      options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
      selected={selected}
      fallback="active"
      ariaLabel="Sort clubs"
      variant="header"
    />
  )
}
