'use client'

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BookCard } from './book-card'
import type { BookSummary } from '@/lib/actions/book.actions'

type SortOption = 'recent' | 'title' | 'wordCount'
type StatusFilter = 'all' | 'Drafting' | 'Revised' | 'Published'

type Props = {
  books: BookSummary[]
  locale: string
}

export function BookGrid({ books, locale }: Props) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortOption>('recent')
  const [filter, setFilter] = useState<StatusFilter>('all')

  // Counts per status (used by the filter chips). Always reflects the full
  // book set, not the filtered/searched view — chips show "how many books
  // I have in each status."
  const counts = useMemo(() => {
    const c = { all: books.length, Drafting: 0, Revised: 0, Published: 0 }
    for (const b of books) c[b.status]++
    return c
  }, [books])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    let result = books
    if (q) {
      result = result.filter(b =>
        b.title.toLowerCase().includes(q) ||
        (b.genre ?? '').toLowerCase().includes(q),
      )
    }
    if (filter !== 'all') {
      result = result.filter(b => b.status === filter)
    }
    const sorted = [...result]
    if (sort === 'recent') sorted.sort((a, b) => new Date(b.lastEditedAt).getTime() - new Date(a.lastEditedAt).getTime())
    if (sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title))
    if (sort === 'wordCount') sorted.sort((a, b) => b.wordCount - a.wordCount)
    return sorted
  }, [books, query, sort, filter])

  return (
    <div className="flex flex-col gap-5">
      {/* Controls row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by title or genre…"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-brand/40 transition-colors"
          />
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortOption)}
          className="px-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-brand/40 cursor-pointer"
        >
          <option value="recent">Recent</option>
          <option value="title">A → Z</option>
          <option value="wordCount">Word count</option>
        </select>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'Drafting', 'Revised', 'Published'] as const).map(key => {
          const count = counts[key]
          if (key !== 'all' && count === 0) return null
          const active = filter === key
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                active
                  ? 'bg-brand text-brand-ink'
                  : 'bg-card border border-border text-foreground hover:border-foreground/30',
              )}
            >
              {key === 'all' ? 'All' : key}
              <span className={cn(
                'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-bold',
                active ? 'bg-brand-ink/15 text-brand-ink' : 'bg-brand text-brand-ink',
              )}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Grid */}
      {visible.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {visible.map(book => (
            <BookCard key={book.id} book={book} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            {query ? `No results for "${query}"` : 'No books match the current filter.'}
          </p>
          <button
            onClick={() => { setQuery(''); setFilter('all') }}
            className="text-sm text-brand hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  )
}
