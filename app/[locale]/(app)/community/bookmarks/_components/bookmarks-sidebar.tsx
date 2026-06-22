'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import type { BookmarkFacets, BookmarkStatus } from '@/lib/actions/library.actions'
import { GENRE_LABEL } from '@/lib/discover/genres'

type Props = {
  facets: BookmarkFacets
  currentStatus: BookmarkStatus
  currentGenres: string[]
  currentQuery: string
  /** True when the viewer has zero bookmarks total — sidebar still renders
   *  but every filter is informational (disabled). */
  isEmpty: boolean
}

const STATUS_OPTIONS: Array<{ value: BookmarkStatus; label: string; countKey: keyof BookmarkFacets['status'] }> = [
  { value: 'all', label: 'All bookmarks', countKey: 'all' },
  { value: 'reading', label: 'Currently reading', countKey: 'reading' },
  { value: 'not-started', label: 'Not started', countKey: 'notStarted' },
  { value: 'finished', label: 'Finished', countKey: 'finished' },
]

export function BookmarksSidebar({
  facets,
  currentStatus,
  currentGenres,
  currentQuery,
  isEmpty,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [query, setQuery] = useState(currentQuery)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Keep input in sync if URL changes externally (e.g. clearing a chip).
  useEffect(() => {
    setQuery(currentQuery)
  }, [currentQuery])

  // "/" focuses the search input (skip if focus already in an editable field).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== '/') return
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      e.preventDefault()
      searchInputRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function updateParams(mutator: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params.toString())
    mutator(next)
    next.delete('page')
    router.replace(`${pathname}?${next.toString()}`)
  }

  function onSearchChange(v: string) {
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateParams((next) => {
        if (v.trim()) next.set('q', v.trim())
        else next.delete('q')
      })
    }, 250)
  }

  function setStatus(v: BookmarkStatus) {
    updateParams((next) => {
      if (v === 'all') next.delete('status')
      else next.set('status', v)
    })
  }

  function toggleGenre(slug: string) {
    const set = new Set(currentGenres)
    if (set.has(slug)) set.delete(slug)
    else set.add(slug)
    updateParams((next) => {
      const list = Array.from(set)
      if (list.length === 0) next.delete('genres')
      else next.set('genres', list.join(','))
    })
  }

  return (
    <aside className="sticky" style={{ top: '24px' }}>
      {/* Search input — top of sidebar */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 mb-3"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: '0.5px solid oklch(1 0 0 / 0.04)',
        }}
      >
        <Search size={16} className="flex-shrink-0" style={{ color: 'var(--canvas-dark-ink-faint)' }} aria-hidden="true" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search bookmarks"
          value={query}
          onChange={(e) => onSearchChange(e.target.value)}
          disabled={isEmpty}
          className="flex-1 bg-transparent border-0 outline-none text-[14px]"
          style={{ color: 'var(--canvas-dark-ink)', fontFamily: 'var(--font-display)' }}
          aria-label="Search bookmarks"
        />
        <kbd
          className="px-1.5 py-0.5 rounded"
          style={{
            background: 'var(--canvas-dark-100)',
            color: 'var(--canvas-dark-ink-faint)',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.35)',
          }}
        >
          /
        </kbd>
      </div>

      {/* Status filter */}
      <Section title="Filter">
        <div className="flex flex-col gap-1">
          {STATUS_OPTIONS.map((opt) => {
            const c = facets.status[opt.countKey]
            const active = currentStatus === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(opt.value)}
                disabled={isEmpty}
                aria-pressed={active}
                className="flex items-center justify-between px-2.5 py-2 text-left transition-colors"
                style={{
                  borderRadius: 'var(--r-row)',
                  color: active ? 'var(--brand)' : 'var(--canvas-dark-ink)',
                  background: active ? 'oklch(0.85 0.18 90 / 0.10)' : 'transparent',
                  opacity: isEmpty ? 0.55 : 1,
                  cursor: isEmpty ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (isEmpty || active) return
                  e.currentTarget.style.background = 'var(--canvas-dark-300)'
                }}
                onMouseLeave={(e) => {
                  if (active) return
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <span className="flex items-center gap-2.5 text-[13px]">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      border: `1.5px solid currentColor`,
                      background: active ? 'currentColor' : 'transparent',
                    }}
                    aria-hidden="true"
                  />
                  {opt.label}
                </span>
                <span
                  className="text-[10px]"
                  style={{ fontFamily: 'var(--font-mono)', opacity: 0.55 }}
                >
                  {c}
                </span>
              </button>
            )
          })}
        </div>
      </Section>

      {/* Genre filter */}
      <Section title="Genre">
        {facets.genres.length === 0 ? (
          <p
            className="m-0 text-[12px]"
            style={{ color: 'var(--canvas-dark-ink-faint)' }}
          >
            Bookmark a few books and genres will populate.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {facets.genres.map((g) => {
              const active = currentGenres.includes(g.slug)
              const label =
                (GENRE_LABEL as Record<string, string>)[g.slug] ??
                g.slug.charAt(0).toUpperCase() + g.slug.slice(1)
              return (
                <button
                  key={g.slug}
                  type="button"
                  onClick={() => toggleGenre(g.slug)}
                  aria-pressed={active}
                  className="text-[11px] px-2.5 py-1.5 transition-colors"
                  style={{
                    borderRadius: 'var(--r-pill)',
                    background: active ? 'oklch(0.85 0.18 90 / 0.18)' : 'var(--canvas-dark-300)',
                    color: active ? 'var(--brand)' : 'var(--canvas-dark-ink)',
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {label} · {g.count}
                </button>
              )
            })}
          </div>
        )}
      </Section>

      {/* Help block — pinned bottom of sidebar */}
      <Section title="Tip">
        <p
          className="m-0 text-[12px] leading-snug"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          Tap the bookmark icon on any book page to save it here. Progress
          updates as you read chapters.
        </p>
      </Section>
    </aside>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="p-4 mb-3"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        border: '0.5px solid oklch(1 0 0 / 0.04)',
      }}
    >
      <div
        className="text-[9.5px] mb-3 font-bold uppercase"
        style={{
          color: 'var(--canvas-dark-ink-faint)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.12em',
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}
