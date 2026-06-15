'use client'
import { useFilterNav } from './use-filter-nav'
import { toggleMulti } from '@/lib/discover/url-state'

type Option = { value: string; label: string }

type Props = {
  name: string
  options: Option[]
  selected: string[]
}

export function FilterCheckboxGroup({ name, options, selected }: Props) {
  const { setParam } = useFilterNav()

  function onToggle(value: string) {
    const next = toggleMulti(selected, value)
    setParam(name, next)
  }

  return (
    <ul className="space-y-1">
      {options.map((opt) => {
        const checked = selected.includes(opt.value)
        // TODO(plan): facet counts — render `(count)` after label when wired.
        return (
          <li key={opt.value}>
            <label className="flex items-center gap-2 text-[11px] cursor-pointer text-[var(--canvas-dark-ink)] hover:text-[var(--canvas-dark-ink-strong)]">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(opt.value)}
                className="accent-[var(--brand)] h-3 w-3"
                aria-label={opt.label}
              />
              <span>{opt.label}</span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}
