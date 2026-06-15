'use client'
import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useFilterNav } from './use-filter-nav'

type Props = {
  name?: string
  placeholder?: string
  initialValue?: string
  debounceMs?: number
}

export function FilterSearchInput({
  name = 'q',
  placeholder = 'Search...',
  initialValue = '',
  debounceMs = 400,
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

  return (
    <div className="relative">
      <Search
        size={12}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--canvas-dark-ink-muted)] pointer-events-none"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full h-8 pl-7 pr-2 text-[11px] rounded-[var(--r-row)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
        style={{
          background: 'var(--canvas-dark-100)',
          boxShadow: 'var(--sh-inset)',
          color: 'var(--canvas-dark-ink)',
        }}
      />
    </div>
  )
}
