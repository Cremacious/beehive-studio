'use client'
import { FilterDropdown } from '@/app/[locale]/(public)/discover/_components/filter-dropdown'

const SORT_OPTIONS = [
  { value: 'active', label: 'Most active' },
  { value: 'newest', label: 'Newest' },
  { value: 'a-z', label: 'A→Z' },
  { value: 'members', label: 'Member count' },
] as const

export type HivesSort = 'active' | 'newest' | 'a-z' | 'members'

type Props = {
  selected: HivesSort
}

/**
 * Thin client wrapper around <FilterDropdown> for the /hives hub's
 * header sort control. FilterDropdown handles URL state via useFilterNav
 * (writes `?sort=X` and drops the param when value equals the fallback
 * `'active'`).
 */
export function HivesSortDropdown({ selected }: Props) {
  return (
    <FilterDropdown
      name="sort"
      options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
      selected={selected}
      fallback="active"
      ariaLabel="Sort hives"
      variant="header"
    />
  )
}
