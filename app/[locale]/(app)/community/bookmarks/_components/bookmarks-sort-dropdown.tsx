'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { BookmarkSort } from '@/lib/actions/library.actions'

const OPTIONS: Array<{ value: BookmarkSort; label: string }> = [
  { value: 'recent', label: 'Recently bookmarked' },
  { value: 'title', label: 'Title (A–Z)' },
  { value: 'author', label: 'Author (A–Z)' },
  { value: 'progress', label: 'Reading progress' },
]

export function BookmarksSortDropdown({ selected }: { selected: BookmarkSort }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const onChange = (value: BookmarkSort) => {
    const next = new URLSearchParams(params.toString())
    if (value === 'recent') next.delete('sort')
    else next.set('sort', value)
    next.delete('page')
    router.replace(`${pathname}?${next.toString()}`)
  }

  return (
    <label
      className="inline-flex items-center gap-2 text-[12px]"
      style={{ color: 'var(--canvas-dark-ink-muted)' }}
    >
      Sort:
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value as BookmarkSort)}
        className="text-[13px] px-3 py-1.5"
        style={{
          background: 'var(--canvas-dark-100)',
          color: 'var(--canvas-dark-ink)',
          boxShadow: 'var(--sh-inset)',
          fontFamily: 'var(--font-display)',
          borderRadius: 'var(--r-row)',
          border: 0,
          outline: 0,
        }}
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}
