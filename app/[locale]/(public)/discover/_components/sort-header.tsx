import { FilterDropdown } from './filter-dropdown'

type Props = {
  count: number
  entityNoun: string
  sortOptions: Array<{ value: string; label: string }>
  selectedSort: string | undefined
}

export function SortHeader({
  count,
  entityNoun,
  sortOptions,
  selectedSort,
}: Props) {
  return (
    <div className="flex items-center justify-between text-[12px] text-[var(--canvas-dark-ink-muted)]">
      <span>
        <strong className="text-[var(--canvas-dark-ink)]">{count.toLocaleString()}</strong>{' '}
        {entityNoun}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.08em]">Sort</span>
        <FilterDropdown
          name="sort"
          options={sortOptions}
          selected={selectedSort}
          ariaLabel="Sort results"
          variant="header"
        />
      </div>
    </div>
  )
}
