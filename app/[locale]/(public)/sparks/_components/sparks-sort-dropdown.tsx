'use client'
import { FilterDropdown } from '@/app/[locale]/(public)/discover/_components/filter-dropdown'

const SORT_OPTIONS = [
  { value: 'recent', label: 'Recent' },
  { value: 'ending', label: 'Ending soon' },
  { value: 'entries', label: 'Most entries' },
  { value: 'status', label: 'Status' },
] as const

export type SparksSort = 'recent' | 'ending' | 'entries' | 'status'

type Props = {
  selected: SparksSort
}

/**
 * Thin client wrapper around <FilterDropdown> for the /sparks hub's
 * header sort control. FilterDropdown handles URL state via useFilterNav
 * (writes `?sort=X` and drops the param when value equals the fallback
 * `'recent'`).
 */
export function SparksSortDropdown({ selected }: Props) {
  return (
    <FilterDropdown
      name="sort"
      options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
      selected={selected}
      fallback="recent"
      ariaLabel="Sort sparks"
      variant="header"
    />
  )
}
