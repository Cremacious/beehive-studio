'use client'

import { useState, useMemo } from 'react'
import { BookCard } from './book-card'
import type { BookSummary } from '@/lib/actions/book.actions'

type SortOption = 'recent' | 'title' | 'wordCount'
type StatusFilter = 'all' | 'Drafting' | 'Revised' | 'Published'
type ViewMode = 'grid' | 'list'

const SORT_LABELS: Record<SortOption, string> = {
  recent: 'Recently edited',
  title: 'Title A → Z',
  wordCount: 'Word count',
}

type Props = {
  books: BookSummary[]
  locale: string
}

export function BookGrid({ books, locale }: Props) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortOption>('recent')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [view, setView] = useState<ViewMode>('grid')

  const counts = useMemo(() => {
    const c = { all: books.length, Drafting: 0, Revised: 0, Published: 0 }
    for (const b of books) c[b.status]++
    return c
  }, [books])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    let result = books
    if (q) {
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.genre ?? '').toLowerCase().includes(q),
      )
    }
    if (filter !== 'all') result = result.filter((b) => b.status === filter)
    const sorted = [...result]
    if (sort === 'recent')
      sorted.sort((a, b) => new Date(b.lastEditedAt).getTime() - new Date(a.lastEditedAt).getTime())
    if (sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title))
    if (sort === 'wordCount') sorted.sort((a, b) => b.wordCount - a.wordCount)
    return sorted
  }, [books, query, sort, filter])

  return (
    <div className="flex flex-col">
      {/* ── Controls bar ── */}
      <div className="flex items-center gap-3 mb-3.5">
        {/* Search */}
        <label className="relative flex-1">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your library — titles, characters, notes…"
            className="w-full outline-none"
            style={{
              height: '44px',
              padding: '0 16px 0 42px',
              borderRadius: 'var(--r-md)',
              background: 'var(--canvas-dark-100)',
              border: '1px solid var(--canvas-dark-300)',
              color: 'var(--canvas-dark-ink-strong)',
              fontFamily: 'inherit',
              fontSize: '14px',
              transition: 'border-color 0.12s, background 0.12s',
            }}
          />
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 uppercase pointer-events-none"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              padding: '3px 7px',
              borderRadius: 'var(--r-xs)',
              background: 'var(--canvas-dark-200)',
              border: '1px solid var(--canvas-dark-300)',
              color: 'var(--canvas-dark-ink-muted)',
              letterSpacing: '0.04em',
            }}
          >
            ⌘ K
          </span>
        </label>

        {/* Sort */}
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="appearance-none cursor-pointer outline-none"
            style={{
              height: '44px',
              padding: '0 36px 0 14px',
              borderRadius: 'var(--r-md)',
              background: 'var(--canvas-dark-100)',
              border: '1px solid var(--canvas-dark-300)',
              color: 'var(--canvas-dark-ink)',
              fontSize: '13px',
              fontWeight: 500,
              fontFamily: 'inherit',
            }}
            aria-label="Sort"
          >
            {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
              <option key={opt} value={opt}>
                {SORT_LABELS[opt]}
              </option>
            ))}
          </select>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {/* View switch */}
        <div
          className="inline-flex gap-0.5"
          style={{
            padding: '3px',
            borderRadius: 'var(--r-md)',
            background: 'var(--canvas-dark-100)',
            border: '1px solid var(--canvas-dark-300)',
          }}
          role="tablist"
          aria-label="View"
        >
          {(['grid', 'list'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-label={v === 'grid' ? 'Grid' : 'List'}
              aria-pressed={view === v}
              className="inline-flex items-center justify-center"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '7px',
                background: view === v ? 'var(--canvas-dark-200)' : 'transparent',
                border: 0,
                color: view === v ? 'var(--canvas-dark-ink-strong)' : 'var(--canvas-dark-ink-muted)',
                cursor: 'pointer',
              }}
            >
              {v === 'grid' ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filter chips ── */}
      <div
        className="flex items-center gap-2 flex-wrap mb-7"
        style={{ paddingBottom: '20px', borderBottom: '1px solid var(--canvas-dark-300)' }}
        role="tablist"
      >
        {(['all', 'Drafting', 'Revised', 'Published'] as const).map((key) => {
          const count = counts[key]
          const active = filter === key
          const dot =
            key === 'Drafting'
              ? 'var(--status-first-draft)'
              : key === 'Revised'
                ? 'var(--status-revised)'
                : key === 'Published'
                  ? 'var(--status-final)'
                  : null
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              role="tab"
              aria-selected={active}
              className="inline-flex items-center gap-2 transition-colors"
              style={{
                padding: '8px 14px 8px 12px',
                borderRadius: 'var(--r-full)',
                background: active ? 'var(--brand-soft)' : 'transparent',
                border: active
                  ? '1px solid oklch(0.85 0.18 90 / 0.35)'
                  : '1px solid var(--canvas-dark-300)',
                color: active ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)',
                fontFamily: 'var(--font-display)',
                fontSize: '13px',
                fontWeight: 600,
                letterSpacing: '0.005em',
                boxShadow: active ? 'var(--el-1)' : undefined,
                cursor: 'pointer',
              }}
            >
              {dot && (
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: dot }} />
              )}
              {key === 'all' ? 'All' : key}
              <span
                className="uppercase"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 500,
                  fontSize: '10px',
                  padding: '2px 7px',
                  borderRadius: 'var(--r-xs)',
                  background: active ? 'var(--brand)' : 'var(--canvas-dark-200)',
                  color: active ? 'var(--brand-ink)' : 'var(--canvas-dark-ink-muted)',
                  letterSpacing: '0.02em',
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Grid (list view is a v2 stub — same grid for now) ── */}
      {visible.length > 0 ? (
        <div
          className="grid"
          style={{
            gridTemplateColumns:
              view === 'grid' ? 'repeat(5, 1fr)' : 'repeat(2, 1fr)',
            gap: '22px',
          }}
        >
          {visible.map((book) => (
            <BookCard key={book.id} book={book} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p
            className="mb-3"
            style={{ fontSize: '13px', color: 'var(--canvas-dark-ink-muted)' }}
          >
            {query ? `No results for "${query}"` : 'No books match the current filter.'}
          </p>
          <button
            onClick={() => {
              setQuery('')
              setFilter('all')
            }}
            className="hover:underline"
            style={{ fontSize: '13px', color: 'var(--brand)', background: 'none', border: 0, cursor: 'pointer' }}
          >
            Clear filters
          </button>
        </div>
      )}

      {/* ── Shelf foot ── */}
      <div
        className="flex justify-between items-center uppercase"
        style={{
          marginTop: '56px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.10em',
          color: 'var(--canvas-dark-ink-muted)',
          paddingTop: '20px',
          borderTop: '1px solid var(--canvas-dark-300)',
        }}
      >
        <span>
          Showing {visible.length} {visible.length === 1 ? 'book' : 'books'} · sorted by{' '}
          {SORT_LABELS[sort].toLowerCase()}
        </span>
      </div>
    </div>
  )
}
