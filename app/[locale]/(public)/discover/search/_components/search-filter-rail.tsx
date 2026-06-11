'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { GENRES, GENRE_LABEL, type GenreSlug } from '@/lib/discover/genres'

type SortKey = 'recent' | 'popular' | 'relevance'

type Props = {
  q: string
  activeGenre: GenreSlug | undefined
  activeTag: string | undefined
  activeSort: SortKey
  locale: string
}

export function SearchFilterRail({
  q,
  activeGenre,
  activeTag,
  activeSort,
  locale,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tagDraft, setTagDraft] = useState(activeTag ?? '')

  function push(next: {
    genre?: string | null
    tag?: string | null
    sort?: SortKey | null
  }) {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    const genre = next.genre === undefined ? activeGenre : next.genre
    const tag = next.tag === undefined ? activeTag : next.tag
    const sort = next.sort === undefined ? activeSort : next.sort
    if (genre) params.set('genre', genre)
    if (tag) params.set('tag', tag)
    if (sort && sort !== 'recent') params.set('sort', sort)
    startTransition(() => {
      router.push(`/${locale}/discover/search?${params.toString()}`, {
        scroll: false,
      })
    })
  }

  function submitTag(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = tagDraft.trim()
    push({ tag: trimmed ? trimmed : null })
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
          htmlFor="search-filter-genre"
          className="text-[10px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)]"
        >
          Genre
        </label>
        <select
          id="search-filter-genre"
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

      <form onSubmit={submitTag} className="flex flex-col gap-1.5">
        <label
          htmlFor="search-filter-tag"
          className="text-[10px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)]"
        >
          Tag
        </label>
        <input
          id="search-filter-tag"
          type="text"
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          placeholder="e.g. dragons"
          className="h-9 px-3 text-[13px] rounded-[var(--r-row)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
          style={{
            background: 'var(--canvas-dark-100)',
            boxShadow: 'var(--sh-inset)',
            color: 'var(--canvas-dark-ink)',
          }}
        />
        <p className="text-[10px] text-[var(--canvas-dark-ink-muted)]">
          Press Enter to apply.
        </p>
      </form>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)]">
          Sort
        </span>
        <div
          role="radiogroup"
          aria-label="Sort results"
          className="flex"
          style={{
            background: 'var(--canvas-dark-100)',
            boxShadow: 'var(--sh-inset)',
            borderRadius: 'var(--r-row)',
            padding: '3px',
            gap: '3px',
          }}
        >
          <SortChip
            label="Recent"
            value="recent"
            active={activeSort === 'recent'}
            onPick={(v) => push({ sort: v })}
          />
          <SortChip
            label="Popular"
            value="popular"
            active={activeSort === 'popular'}
            onPick={(v) => push({ sort: v })}
          />
          <SortChip
            label="Relevance"
            value="relevance"
            active={activeSort === 'relevance'}
            onPick={(v) => push({ sort: v })}
          />
        </div>
      </div>
    </aside>
  )
}

function SortChip({
  label,
  value,
  active,
  onPick,
}: {
  label: string
  value: SortKey
  active: boolean
  onPick: (v: SortKey) => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onPick(value)}
      className="flex-1 h-7 text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] rounded-[calc(var(--r-row)_-_3px)] transition-colors"
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
