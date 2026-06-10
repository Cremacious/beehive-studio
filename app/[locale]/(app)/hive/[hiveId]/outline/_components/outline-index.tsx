'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import { readContent, type Beat, type BeatColor } from '@/app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board'
import { HiveSectionDivider } from '../../_components/hive-section-divider'

type OutlineSummary = {
  outline: BinderItemRow
  lastEditedByUsername: string | null
  lastEditedAt: Date | null
}

type SortKey = 'recent' | 'alpha' | 'beats'

function relTime(d: Date | null): string {
  if (!d) return '–'
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
    <div className="pb-6">
      <HiveSectionDivider label="Filter" hideTopBorder>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div
            className="flex flex-1 items-center gap-2 px-3 py-2"
            style={{
              background: 'var(--canvas-dark-100)',
              borderRadius: 'var(--r-row)',
              boxShadow: 'var(--sh-inset)',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4 flex-shrink-0"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search outlines…"
              className="flex-1 bg-transparent text-sm font-geist placeholder:text-[var(--canvas-dark-ink-muted)] focus:outline-none"
              style={{ color: 'var(--canvas-dark-ink)' }}
            />
          </div>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            style={{
              background: 'var(--canvas-dark-100)',
              borderRadius: 'var(--r-row)',
              boxShadow: 'var(--sh-inset)',
              color: 'var(--canvas-dark-ink)',
              width: 190,
            }}
            className="px-3 py-2 text-sm font-geist focus:outline-none flex-shrink-0"
          >
            <option value="recent">Recently edited</option>
            <option value="beats">Most beats</option>
            <option value="alpha">A – Z</option>
          </select>
        </div>
      </HiveSectionDivider>

      <section
        className="pt-1"
        style={{ borderTop: '1px solid oklch(from var(--canvas-dark-300) l c h / 0.5)' }}
      >
        <p
          className="px-6 pt-5 pb-3 font-mono text-[10px] uppercase tracking-wider"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          Outlines
        </p>
        <div
          className="grid items-center gap-4 px-6 py-2.5 text-[10px] font-mono uppercase tracking-wider"
          style={{
            gridTemplateColumns: '1fr 90px 130px',
            color: 'var(--canvas-dark-ink-muted)',
            background: 'var(--canvas-dark-100)',
            borderTop: '1px solid var(--br-card)',
            borderBottom: '1px solid var(--br-card)',
          }}
        >
          <span>Outline</span>
          <span className="text-center">Beats</span>
          <span className="text-right">Last edit</span>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--canvas-dark-ink-strong)' }}>
              {outlines.length === 0 ? 'No outlines yet' : 'No matches'}
            </p>
            <p className="text-xs font-mono mt-1" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
              {outlines.length === 0
                ? 'Start one with the New Outline button above.'
                : 'Try a different search term.'}
            </p>
          </div>
        ) : (
          <ul
            className="divide-y"
            style={{ borderColor: 'oklch(from var(--canvas-dark-300) l c h / 0.4)' }}
          >
            {filtered.map(o => {
              const beats = getBeats(o.outline)
              const colors = uniqueColorsInUse(beats)
              return (
                <li key={o.outline.id}>
                  <Link
                    href={`/${locale}/hive/${hiveId}/outline/${o.outline.id}`}
                    className="grid items-center gap-4 px-6 py-4 transition-colors hover:bg-[var(--canvas-dark-300)]"
                    style={{ gridTemplateColumns: '1fr 90px 130px' }}
                  >
                    <div className="min-w-0 flex flex-col gap-[7px]">
                      <span
                        className="font-comfortaa truncate"
                        style={{
                          color: 'var(--canvas-dark-ink-strong)',
                          fontWeight: 500,
                          fontSize: 15,
                        }}
                      >
                        {o.outline.title || 'Untitled outline'}
                      </span>
                      {colors.length > 0 && (
                        <span className="inline-flex gap-[5px]">
                          {colors.map(c => (
                            <span
                              key={c}
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: 'var(--r-pill)',
                                background: `var(--beat-${c})`,
                                boxShadow: `0 0 0 2px oklch(from var(--beat-${c}) l c h / 0.18)`,
                                display: 'inline-block',
                                flexShrink: 0,
                              }}
                            />
                          ))}
                        </span>
                      )}
                    </div>
                    <span
                      className="text-center"
                      style={{
                        fontVariantNumeric: 'tabular-nums',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--canvas-dark-ink-muted)',
                        fontSize: 13,
                      }}
                    >
                      {beats.length}
                    </span>
                    <span
                      className="text-right"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        letterSpacing: '0.04em',
                        color: 'var(--canvas-dark-ink-muted)',
                      }}
                    >
                      {relTime(o.lastEditedAt)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
