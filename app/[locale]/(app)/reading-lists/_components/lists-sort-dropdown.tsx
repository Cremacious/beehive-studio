'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

const SORT_OPTIONS = [
  { value: 'recent', label: 'Most recent' },
  { value: 'most-followed', label: 'Most followed' },
  { value: 'a-z', label: 'A → Z' },
  { value: 'most-books', label: 'Most books' },
] as const

export type ListsSort = 'recent' | 'most-followed' | 'a-z' | 'most-books'

type Props = {
  selected: ListsSort
}

/**
 * Native <select> styled to match the hub chrome. Preserves `?tab=` on change
 * and resets `?page=` to 1. The `recent` fallback drops the param when
 * selected so default URLs stay clean.
 */
export function ListsSortDropdown({ selected }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value
    const sp = new URLSearchParams(searchParams.toString())
    if (next === 'recent') {
      sp.delete('sort')
    } else {
      sp.set('sort', next)
    }
    sp.delete('page')
    const qs = sp.toString()
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    })
  }

  return (
    <label className="inline-flex items-center gap-2 text-[12px] text-[var(--canvas-dark-ink-muted)]">
      <span>Sort:</span>
      <select
        value={selected}
        onChange={onChange}
        disabled={isPending}
        aria-label="Sort reading lists"
        className="px-2 py-1 text-[12px] text-[var(--canvas-dark-ink)] rounded-md border-0 outline-none focus:ring-1 focus:ring-[var(--brand)]"
        style={{
          background: 'rgba(255, 255, 255, 0.04)',
        }}
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
