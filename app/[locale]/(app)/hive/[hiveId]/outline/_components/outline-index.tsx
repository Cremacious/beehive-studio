'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ListOrdered } from 'lucide-react'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import { readContent, type Beat, type BeatColor } from '@/app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board'

type OutlineSummary = {
  outline: BinderItemRow
  lastEditedByUsername: string | null
  lastEditedAt: Date | null
}

type SortKey = 'recent' | 'alpha' | 'beats'

function relTime(d: Date | null): string {
  if (!d) return '—'
  const seconds = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function getBeats(o: BinderItemRow): Beat[] {
  return readContent(o.content).beats
}

function uniqueColorsInUse(beats: Beat[]): BeatColor[] {
  const seen = new Set<BeatColor>()
  const out: BeatColor[] = []
  for (const b of beats) {
    if (b.color && !seen.has(b.color)) {
      seen.add(b.color)
      out.push(b.color)
      if (out.length >= 6) break
    }
  }
  return out
}

export function OutlineIndex({
  outlines,
  hiveId,
  locale,
}: {
  outlines: OutlineSummary[]
  hiveId: string
  locale: string
}) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    let list = outlines
    if (s) list = list.filter(o => o.outline.title.toLowerCase().includes(s))
    if (sort === 'alpha') {
      list = [...list].sort((a, b) => a.outline.title.localeCompare(b.outline.title))
    } else if (sort === 'beats') {
      list = [...list].sort((a, b) => getBeats(b.outline).length - getBeats(a.outline).length)
    } else {
      list = [...list].sort((a, b) => {
        const at = a.lastEditedAt?.getTime() ?? 0
        const bt = b.lastEditedAt?.getTime() ?? 0
        return bt - at
      })
    }
    return list
  }, [outlines, search, sort])

  return (
    <>
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1
            style={{ color: 'var(--brand)' }}
            className="font-comfortaa font-bold text-2xl"
          >
            Outlines
          </h1>
          <p className="text-xs font-mono text-[var(--canvas-dark-ink-muted)] mt-1">
            {outlines.length} {outlines.length === 1 ? 'outline' : 'outlines'} in this hive
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search outline titles…"
          style={{
            background: 'var(--canvas-dark-100)',
            borderRadius: 'var(--r-row)',
            boxShadow: 'var(--sh-inset)',
            border: 'var(--br-card)',
            color: 'var(--canvas-dark-ink)',
          }}
          className="flex-1 px-3 py-2 text-sm font-geist placeholder:text-[var(--canvas-dark-ink-muted)] focus:outline-none"
        />
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          style={{
            background: 'var(--canvas-dark-100)',
            borderRadius: 'var(--r-row)',
            boxShadow: 'var(--sh-inset)',
            border: 'var(--br-card)',
            color: 'var(--canvas-dark-ink)',
          }}
          className="px-3 py-2 text-sm font-geist focus:outline-none"
        >
          <option value="recent">Recent</option>
          <option value="alpha">A → Z</option>
          <option value="beats">Most beats</option>
        </select>
      </div>

      <div
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
        }}
        className="overflow-hidden"
      >
        <div
          className="grid items-center gap-4 px-5 py-2.5 text-[10px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]"
          style={{
            gridTemplateColumns: '1fr 90px 130px',
            borderBottom: '1px solid var(--canvas-dark-300)',
            background:
              'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          }}
        >
          <span>Outline</span>
          <span className="text-center inline-flex items-center justify-center gap-1">
            <ListOrdered size={10} />
            Beats
          </span>
          <span className="text-right">Last edit</span>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-sm font-medium text-[var(--canvas-dark-ink-strong)]">
              {outlines.length === 0 ? 'No outlines yet' : 'No matches'}
            </p>
            <p className="text-xs font-mono text-[var(--canvas-dark-ink-muted)] mt-1">
              {outlines.length === 0
                ? 'The author can create an outline in the studio.'
                : 'Try a different search term.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--canvas-dark-300)' }}>
            {filtered.map(o => {
              const beats = getBeats(o.outline)
              const colors = uniqueColorsInUse(beats)
              return (
                <li key={o.outline.id}>
                  <Link
                    href={`/${locale}/hive/${hiveId}/outline/${o.outline.id}`}
                    className="grid items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--canvas-dark-300)]"
                    style={{ gridTemplateColumns: '1fr 90px 130px' }}
                  >
                    <div className="min-w-0">
                      <h3 className="font-comfortaa font-semibold text-base truncate text-[var(--canvas-dark-ink-strong)]">
                        {o.outline.title || 'Untitled outline'}
                      </h3>
                      {colors.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {colors.map(c => (
                            <span
                              key={c}
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: `var(--beat-${c})`,
                                display: 'inline-block',
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <div className="font-comfortaa font-bold text-lg text-[var(--canvas-dark-ink-strong)] leading-none">
                        {beats.length}
                      </div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mt-0.5">
                        {beats.length === 1 ? 'beat' : 'beats'}
                      </div>
                    </div>
                    <div className="text-right text-xs text-[var(--canvas-dark-ink)]">
                      {relTime(o.lastEditedAt)}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
