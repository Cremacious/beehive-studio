'use client'
import { useFilterNav } from './use-filter-nav'

type Option = { value: string; label: string }

type Props = {
  name: string
  options: Option[]
  selected: string | undefined
  /** If picked value equals fallback, drop the URL param. Defaults to first option. */
  fallback?: string
  ariaLabel?: string
  variant?: 'sidebar' | 'header'
}

export function FilterDropdown({
  name,
  options,
  selected,
  fallback,
  ariaLabel,
  variant = 'sidebar',
}: Props) {
  const { setParam } = useFilterNav()
  const fb = fallback ?? options[0]?.value

  function onChange(value: string) {
    if (value === fb) setParam(name, null)
    else setParam(name, value)
  }

  const sizeClass = variant === 'header' ? 'h-7 text-[11px]' : 'h-7 text-[11px] w-full'

  return (
    <select
      value={selected ?? fb ?? ''}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel ?? name}
      className={`${sizeClass} px-2 rounded-[var(--r-row)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]`}
      style={{
        background: 'var(--canvas-dark-100)',
        boxShadow: 'var(--sh-inset)',
        color: 'var(--canvas-dark-ink)',
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
