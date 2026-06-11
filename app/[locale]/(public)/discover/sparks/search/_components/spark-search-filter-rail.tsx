'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { GENRES, GENRE_LABEL, type GenreSlug } from '@/lib/discover/genres'
import type { SparkStatus } from '@/lib/actions/discover-sparks.actions'

type StatusFilter = SparkStatus | 'all'
type SortKey = 'relevance' | 'recent' | 'urgent' | 'most-entered'

type Props = {
  q: string
  activeGenre: GenreSlug | undefined
  activeStatus: StatusFilter
  activeSort: SortKey
  locale: string
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'VOTING', label: 'Voting' },
  { value: 'CLOSED', label: 'Closed' },
]

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'most-entered', label: 'Most entered' },
  { value: 'relevance', label: 'Relevance' },
]

export function SparkSearchFilterRail({
  q,
  activeGenre,
  activeStatus,
  activeSort,
  locale,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function push(next: {
    genre?: string | null
    status?: StatusFilter | null
    sort?: SortKey | null
  }) {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    const genre = next.genre === undefined ? activeGenre : next.genre
    const status = next.status === undefined ? activeStatus : next.status
    const sort = next.sort === undefined ? activeSort : next.sort
    if (genre) params.set('genre', genre)
    if (status && status !== 'all') params.set('status', status)
    if (sort && sort !== 'recent') params.set('sort', sort)
    startTransition(() => {
      router.push(
        `/${locale}/discover/sparks/search?${params.toString()}`,
        { scroll: false },
      )
    })
  }

  return (
    <aside
      className="p-4 flex flex-col gap-5"
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        borderTop: '1px solid var(--br-card)',
        opacity: isPending ? 0.7 : 1,
      }}
    >
      <h2 className="font-[family-name:var(--font-comfortaa)] font-bold text-[14px] text-[var(--brand)]">
        Refine results
      </h2>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="spark-filter-genre"
          className="text-[10px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)]"
        >
          Genre
        </label>
        <select
          id="spark-filter-genre"
          value={activeGenre ?? ''}
          onChange={(e) => push({ genre: e.target.value || null })}
          className="h-9 px-2 text-[13px] rounded-[var(--r-row)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
          style={{
            background: 'var(--canvas-dark-100)',
            boxShadow: 'var(--sh-inset)',
            color: 'var(--canvas-dark-ink)',
          }}
        >
          <option value="">All genres</option>
          {GENRES.map((slug) => (
            <option key={slug} value={slug}>
              {GENRE_LABEL[slug]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)]">
          Status
        </span>
        <div
          role="radiogroup"
          aria-label="Filter by status"
          className="flex"
          style={{
            background: 'var(--canvas-dark-100)',
            boxShadow: 'var(--sh-inset)',
            borderRadius: 'var(--r-row)',
            padding: '3px',
            gap: '3px',
          }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <SegmentChip
              key={opt.value}
              label={opt.label}
              active={activeStatus === opt.value}
              onPick={() => push({ status: opt.value })}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)]">
          Sort
        </span>
        <div
          role="radiogroup"
          aria-label="Sort results"
          className="grid grid-cols-2"
          style={{
            background: 'var(--canvas-dark-100)',
            boxShadow: 'var(--sh-inset)',
            borderRadius: 'var(--r-row)',
            padding: '3px',
            gap: '3px',
          }}
        >
          {SORT_OPTIONS.map((opt) => (
            <SegmentChip
              key={opt.value}
              label={opt.label}
              active={activeSort === opt.value}
              onPick={() => push({ sort: opt.value })}
            />
          ))}
        </div>
      </div>
    </aside>
  )
}

function SegmentChip({
  label,
  active,
  onPick,
}: {
  label: string
  active: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onPick}
      className="flex-1 h-7 px-2 text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] rounded-[calc(var(--r-row)_-_3px)] transition-colors whitespace-nowrap"
      style={
        active
          ? { background: 'var(--brand)', color: 'var(--brand-ink)' }
          : { background: 'transparent', color: 'var(--canvas-dark-ink-muted)' }
      }
    >
      {label}
    </button>
  )
}
