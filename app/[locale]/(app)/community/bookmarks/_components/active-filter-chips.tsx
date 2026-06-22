'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import type { BookmarkStatus } from '@/lib/actions/library.actions'
import { GENRE_LABEL } from '@/lib/discover/genres'

type Props = {
  query: string
  status: BookmarkStatus
  genres: string[]
}

const STATUS_LABEL: Record<BookmarkStatus, string> = {
  all: 'All',
  reading: 'Currently reading',
  'not-started': 'Not started',
  finished: 'Finished',
}

export function ActiveFilterChips({ query, status, genres }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const chips: Array<{ key: string; label: string; onClear: () => void }> = []

  if (query) {
    chips.push({
      key: 'q',
      label: `“${query}”`,
      onClear: () => clearKey('q'),
    })
  }
  if (status !== 'all') {
    chips.push({
      key: 'status',
      label: STATUS_LABEL[status],
      onClear: () => clearKey('status'),
    })
  }
  for (const g of genres) {
    const label = (GENRE_LABEL as Record<string, string>)[g] ?? g
    chips.push({
      key: `g:${g}`,
      label,
      onClear: () => removeGenre(g),
    })
  }

  function update(mutator: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params.toString())
    mutator(next)
    next.delete('page')
    router.replace(`${pathname}?${next.toString()}`)
  }
  function clearKey(k: string) {
    update((n) => n.delete(k))
  }
  function removeGenre(slug: string) {
    update((n) => {
      const remaining = genres.filter((x) => x !== slug)
      if (remaining.length === 0) n.delete('genres')
      else n.set('genres', remaining.join(','))
    })
  }
  function clearAll() {
    update((n) => {
      n.delete('q')
      n.delete('status')
      n.delete('genres')
    })
  }

  if (chips.length === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap mb-4">
      <span
        className="text-[9.5px] uppercase font-bold"
        style={{
          color: 'var(--canvas-dark-ink-faint)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.12em',
        }}
      >
        Filters
      </span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onClear}
          className="inline-flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 transition-colors hover:bg-[var(--canvas-dark-300)]"
          style={{
            background: 'oklch(0.85 0.18 90 / 0.10)',
            color: 'var(--brand)',
            borderRadius: 'var(--r-pill)',
            border: '1px solid oklch(0.85 0.18 90 / 0.25)',
            cursor: 'pointer',
            fontWeight: 600,
          }}
          aria-label={`Remove filter ${chip.label}`}
        >
          {chip.label}
          <X size={11} aria-hidden="true" />
        </button>
      ))}
      <button
        type="button"
        onClick={clearAll}
        className="text-[11px] underline"
        style={{ color: 'var(--canvas-dark-ink-muted)', cursor: 'pointer' }}
      >
        Clear all
      </button>
    </div>
  )
}
