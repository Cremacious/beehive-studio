'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, ChevronDown, Hexagon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BookCard } from './book-card'
import { HiveCard } from './hive-card'
import { CreateHiveModal } from './create-hive-modal'
import type { BookSummary } from '@/lib/actions/book.actions'
import type { UserHiveView } from '@/lib/actions/hive.actions'

type Tab = 'all' | 'books' | 'hives'
type Sort = 'recent' | 'alpha' | 'books-first' | 'hives-first'

const PAGE_SIZE = 24

const SORT_LABELS: Record<Sort, string> = {
  recent: 'Recent',
  alpha: 'A – Z',
  'books-first': 'Books first',
  'hives-first': 'Hives first',
}

type LibraryItem =
  | { kind: 'book'; id: string; sortKey: string; recency: number; data: BookSummary }
  | { kind: 'hive'; id: string; sortKey: string; recency: number; data: UserHiveView }

type Props = {
  books: BookSummary[]
  hives: UserHiveView[]
  locale: string
}

export function LibraryGrid({ books, hives, locale }: Props) {
  const [tab, setTab] = useState<Tab>('all')
  const [sort, setSort] = useState<Sort>('recent')
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [createOpen, setCreateOpen] = useState(false)
  const [prelockBookId, setPrelockBookId] = useState<string | null>(null)

  // Auto-open hive create modal when redirected from book wizard with ?createHive=<bookId>
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const createHiveParam = sp.get('createHive')
  useEffect(() => {
    if (!createHiveParam) return
    setPrelockBookId(createHiveParam)
    setCreateOpen(true)
    const next = new URLSearchParams(sp.toString())
    next.delete('createHive')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [createHiveParam, pathname, router, sp])

  // Normalize books + hives into a single sortable/filterable list.
  const items = useMemo<LibraryItem[]>(() => {
    const bookItems: LibraryItem[] = books.map((b) => ({
      kind: 'book',
      id: `book:${b.id}`,
      sortKey: b.title.toLowerCase(),
      recency: new Date(b.lastEditedAt).getTime(),
      data: b,
    }))
    const hiveItems: LibraryItem[] = hives.map((h) => ({
      kind: 'hive',
      id: `hive:${h.id}`,
      sortKey: h.name.toLowerCase(),
      recency: h.lastActiveAt ? new Date(h.lastActiveAt).getTime() : 0,
      data: h,
    }))
    return [...bookItems, ...hiveItems]
  }, [books, hives])

  const counts = useMemo(
    () => ({ all: items.length, books: books.length, hives: hives.length }),
    [items.length, books.length, hives.length],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let result = items
    if (tab === 'books') result = result.filter((i) => i.kind === 'book')
    else if (tab === 'hives') result = result.filter((i) => i.kind === 'hive')
    if (q) {
      result = result.filter((i) => {
        if (i.kind === 'book') {
          const b = i.data
          return (
            b.title.toLowerCase().includes(q) ||
            (b.genre ?? '').toLowerCase().includes(q)
          )
        }
        const h = i.data
        return (
          h.name.toLowerCase().includes(q) ||
          (h.description ?? '').toLowerCase().includes(q) ||
          (h.bookTitle ?? '').toLowerCase().includes(q)
        )
      })
    }
    const sorted = [...result]
    if (sort === 'recent') sorted.sort((a, b) => b.recency - a.recency)
    else if (sort === 'alpha') sorted.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    else if (sort === 'books-first') {
      sorted.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'book' ? -1 : 1
        return b.recency - a.recency
      })
    } else if (sort === 'hives-first') {
      sorted.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'hive' ? -1 : 1
        return b.recency - a.recency
      })
    }
    return sorted
  }, [items, tab, query, sort])

  // Reset pagination when filter / sort / query change.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [tab, query, sort])

  const visibleItems = filtered.slice(0, visibleCount)
  const remaining = Math.max(0, filtered.length - visibleItems.length)

  const noMatchesAfterFilter =
    filtered.length === 0 && (query.trim().length > 0 || tab !== 'all')

  return (
    <section className="flex flex-col">
      {/* ── Controls bar (panel chrome) ── */}
      <div
        style={{
          padding: '14px 16px',
          marginBottom: '20px',
          background:
            'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card)',
          border: 'var(--br-card)',
          boxShadow: 'var(--sh-card)',
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* Filter chip strip */}
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Filter by type">
            {(['all', 'books', 'hives'] as const).map((key) => {
              const active = tab === key
              const count = counts[key]
              const label = key === 'all' ? 'All' : key === 'books' ? 'Books' : 'Hives'
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  role="tab"
                  aria-selected={active}
                  className="inline-flex items-center gap-1.5 transition-colors"
                  style={{
                    padding: '7px 13px',
                    borderRadius: 'var(--r-pill)',
                    background: active
                      ? 'var(--brand)'
                      : 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                    color: active ? 'var(--brand-ink)' : 'var(--canvas-dark-ink)',
                    fontFamily: 'var(--font-display)',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    border: active ? 'none' : 'var(--br-card)',
                    boxShadow: 'var(--sh-tile)',
                    cursor: 'pointer',
                  }}
                >
                  {label}
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: 'var(--r-pill)',
                      background: active
                        ? 'oklch(from var(--brand-ink) l c h / 0.18)'
                        : 'oklch(0 0 0 / 0.25)',
                      color: active ? 'var(--brand-ink)' : 'var(--canvas-dark-ink-muted)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          <div
            aria-hidden="true"
            style={{ width: '1px', height: '24px', background: 'var(--canvas-dark-300)' }}
          />

          {/* Search (recessed input) */}
          <label className="relative flex-1" style={{ minWidth: '200px' }}>
            <Search
              size={14}
              className="absolute pointer-events-none"
              style={{
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--canvas-dark-ink-muted)',
              }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your library…"
              className="w-full outline-none"
              style={{
                height: '36px',
                padding: '0 14px 0 34px',
                borderRadius: 'var(--r-row)',
                background: 'var(--canvas-dark-100)',
                boxShadow: 'var(--sh-inset)',
                border: 'none',
                color: 'var(--canvas-dark-ink-strong)',
                fontFamily: 'inherit',
                fontSize: '13px',
              }}
            />
          </label>

          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-2 transition-colors"
                style={{
                  height: '36px',
                  padding: '0 14px',
                  borderRadius: 'var(--r-pill)',
                  background:
                    'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                  color: 'var(--canvas-dark-ink-strong)',
                  fontFamily: 'var(--font-display)',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  border: 'var(--br-card)',
                  boxShadow: 'var(--sh-tile)',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    color: 'var(--canvas-dark-ink-muted)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Sort
                </span>
                {SORT_LABELS[sort]}
                <ChevronDown size={14} strokeWidth={2} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(SORT_LABELS) as Sort[]).map((opt) => (
                <DropdownMenuItem
                  key={opt}
                  onSelect={() => setSort(opt)}
                  className={sort === opt ? 'font-semibold' : ''}
                >
                  {SORT_LABELS[opt]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Grid ── */}
      {visibleItems.length > 0 ? (
        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: '14px',
          }}
        >
          {visibleItems.map((item) =>
            item.kind === 'book' ? (
              <LibraryBookCard key={item.id} book={item.data} locale={locale} />
            ) : (
              <LibraryHiveCard key={item.id} hive={item.data} />
            ),
          )}
        </div>
      ) : noMatchesAfterFilter ? (
        <NoMatches
          onClear={() => {
            setQuery('')
            setTab('all')
          }}
        />
      ) : null}

      {/* ── Pagination ── */}
      {remaining > 0 && (
        <div className="flex justify-center" style={{ marginTop: '32px' }}>
          <button
            type="button"
            onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
            className="inline-flex items-center gap-2 transition-colors"
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--r-pill)',
              background:
                'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
              color: 'var(--canvas-dark-ink-strong)',
              fontFamily: 'var(--font-display)',
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.02em',
              border: 'var(--br-card)',
              boxShadow: 'var(--sh-tile)',
              cursor: 'pointer',
            }}
          >
            Show more
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: 'var(--r-pill)',
                background: 'oklch(0 0 0 / 0.25)',
                color: 'var(--canvas-dark-ink-muted)',
                letterSpacing: '0.04em',
              }}
            >
              {remaining} remaining
            </span>
          </button>
        </div>
      )}

      {/* ── Shelf foot ── */}
      {filtered.length > 0 && (
        <div
          className="flex justify-between items-center uppercase"
          style={{
            marginTop: '48px',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.10em',
            color: 'var(--canvas-dark-ink-muted)',
            paddingTop: '20px',
            borderTop: '1px solid var(--canvas-dark-300)',
          }}
        >
          <span>
            Showing {visibleItems.length} of {filtered.length} ·{' '}
            {SORT_LABELS[sort].toLowerCase()}
          </span>
        </div>
      )}

      <CreateHiveModal
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v)
          if (!v) setPrelockBookId(null)
        }}
        prelockBookId={prelockBookId}
      />
    </section>
  )
}

/**
 * Card wrapper that adds the unified type-badge in the top-right of the cover.
 * Books and hives use their existing card chrome but with the badge overlay so
 * they're visually distinct at a glance in the unified grid.
 */
function LibraryBookCard({ book, locale }: { book: BookSummary; locale: string }) {
  return (
    <div className="relative">
      <TypeBadge kind="book" />
      <BookCard book={book} locale={locale} />
    </div>
  )
}

function LibraryHiveCard({ hive }: { hive: UserHiveView }) {
  return (
    <div className="relative">
      <TypeBadge kind="hive" />
      <HiveCard hive={hive} />
    </div>
  )
}

function TypeBadge({ kind }: { kind: 'book' | 'hive' }) {
  // Hive cards get a distinguishing badge on the cover; book cards already
  // carry a status pill (top-left) and kebab (top-right) so we skip the badge
  // for books and rely on the paper-warm cover treatment to signal "book".
  if (kind === 'book') return null
  return (
    <span
      aria-label="Hive"
      className="absolute inline-flex items-center gap-1 uppercase pointer-events-none"
      style={{
        top: '12px',
        left: '12px',
        zIndex: 3,
        padding: '4px 9px 4px 7px',
        borderRadius: 'var(--r-pill)',
        background:
          'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        color: 'var(--brand)',
        fontFamily: 'var(--font-display)',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.08em',
        boxShadow: 'var(--sh-tile)',
        border: 'var(--br-card)',
      }}
    >
      <Hexagon size={11} strokeWidth={2.4} />
      Hive
    </span>
  )
}

function NoMatches({ onClear }: { onClear: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{
        padding: '64px 24px',
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-card)',
        border: 'var(--br-card)',
        boxShadow: 'var(--sh-card)',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: 'var(--r-pill)',
          background:
            'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          boxShadow: 'var(--sh-tile)',
          color: 'var(--canvas-dark-ink-muted)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '12px',
        }}
        aria-hidden="true"
      >
        <Search size={20} strokeWidth={2} />
      </div>
      <div
        className="font-comfortaa font-bold mb-1.5"
        style={{
          color: 'var(--canvas-dark-ink-strong)',
          fontSize: '17px',
        }}
      >
        No matches
      </div>
      <p
        className="m-0 mb-5"
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '13px',
          color: 'var(--canvas-dark-ink-muted)',
          maxWidth: '360px',
        }}
      >
        Nothing in your library matches the current filter and search.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex items-center transition-colors"
        style={{
          padding: '8px 16px',
          borderRadius: 'var(--r-pill)',
          background: 'var(--brand)',
          color: 'var(--brand-ink)',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: '12px',
          letterSpacing: '0.02em',
          border: 'none',
          boxShadow: 'var(--sh-tile)',
          cursor: 'pointer',
        }}
      >
        Clear filters
      </button>
    </div>
  )
}
