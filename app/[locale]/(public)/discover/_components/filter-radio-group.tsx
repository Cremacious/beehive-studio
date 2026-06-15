'use client'
import { useFilterNav } from './use-filter-nav'

type Option = { value: string; label: string }

type Props = {
  name: string
  options: Option[]
  selected: string | undefined
  /** If selected equals this, the URL param is dropped instead of set. Defaults to first option's value. */
  fallback?: string
}

export function FilterRadioGroup({ name, options, selected, fallback }: Props) {
  const { setParam } = useFilterNav()
  const fb = fallback ?? options[0]?.value

  function onPick(value: string) {
    if (value === fb) {
      setParam(name, null)
    } else {
      setParam(name, value)
    }
  }

  return (
    <ul className="space-y-1" role="radiogroup" aria-label={name}>
      {options.map((opt) => {
        const checked = (selected ?? fb) === opt.value
        // TODO(plan): facet counts — render `(count)` after label when wired.
        return (
          <li key={opt.value}>
            <label className="flex items-center gap-2 text-[11px] cursor-pointer text-[var(--canvas-dark-ink)] hover:text-[var(--canvas-dark-ink-strong)]">
              <input
                type="radio"
                name={name}
                checked={checked}
                onChange={() => onPick(opt.value)}
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
