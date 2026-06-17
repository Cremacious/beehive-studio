'use client'
import { HubSortDropdown } from '@/components/hub/hub-sort-dropdown'

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

export function SparksSortDropdown({ selected }: Props) {
  return (
    <HubSortDropdown
      name="sort"
      options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
      selected={selected}
      fallback="recent"
      ariaLabel="Sort sparks"
    />
  )
}
