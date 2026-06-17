'use client'
import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useFilterNav } from './use-filter-nav'

type Props = {
  name?: string
  placeholder?: string
  initialValue?: string
  debounceMs?: number
  /** 'hero' renders a taller, more prominent input for the discover header panel. */
  variant?: 'default' | 'hero'
}

export function FilterSearchInput({
  name = 'q',
  placeholder = 'Search...',
  initialValue = '',
  debounceMs = 400,
  variant = 'default',
}: Props) {
  const { setParam } = useFilterNav()
  const [value, setValue] = useState(initialValue)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSent = useRef(initialValue)

  useEffect(() => {
    if (value === lastSent.current) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      lastSent.current = value
      setParam(name, value.trim() || null)
    }, debounceMs)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [value, name, debounceMs, setParam])

  const isHero = variant === 'hero'

  return (
    <div className="relative">
      <Search
        size={isHero ? 16 : 12}
        className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          left: isHero ? 14 : 10,
          color: isHero ? 'oklch(from var(--brand) l c h / 0.55)' : 'var(--canvas-dark-ink-muted)',
        }}
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={[
          'w-full focus:outline-none focus:ring-1 focus:ring-[var(--brand)]',
          isHero
            ? 'h-11 pl-11 pr-3 text-[13px] rounded-[12px]'
            : 'h-8 pl-7 pr-2 text-[11px] rounded-[var(--r-row)]',
        ].join(' ')}
        style={{
          background: 'var(--canvas-dark-100)',
          boxShadow: isHero
            ? 'inset 0 2px 6px rgba(0,0,0,0.5), 0 0 0 1.5px rgba(255,195,0,0.18)'
            : 'var(--sh-inset)',
          color: 'var(--canvas-dark-ink)',
        }}
      />
    </div>
  )
}
