'use client'
import { HubSortDropdown } from '@/components/hub/hub-sort-dropdown'

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

export function ClubsSortDropdown({ selected }: Props) {
  return (
    <HubSortDropdown
      name="sort"
      options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
      selected={selected}
      fallback="active"
      ariaLabel="Sort clubs"
    />
  )
}
