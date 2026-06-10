'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'

const GENRES = ['Fantasy', 'Sci-Fi', 'Romance', 'Thriller', 'Horror', 'Mystery', 'Literary', 'Historical']

const SORT_LABELS: Record<string, { label: string; description: string }> = {
  trending: { label: '🔥 Trending', description: 'Books gaining the most likes and readers this week' },
  popular: { label: '⭐ Popular', description: 'All-time community favorites' },
  new: { label: '✨ New', description: 'Freshest uploads, straight from the hive' },
}

type Props = {
  currentSort: string
  currentGenre: string | undefined
}

export function FeedFilters({ currentSort, currentGenre }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const locale = pathname.split('/')[1]

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === null) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
      params.delete('page')
      router.push(`/${locale}/discover?${params.toString()}`)
    },
    [router, searchParams]
  )

  const sortInfo = SORT_LABELS[currentSort] ?? SORT_LABELS.trending

  const segActive = {
    background: 'var(--brand)',
    color: 'var(--brand-ink)',
  } as const
  const segIdle = {
    background: 'transparent',
    color: 'var(--canvas-dark-ink-muted)',
  } as const

  return (
    <div>
      <div
        className="px-6 py-4 flex items-center gap-3 flex-wrap"
        style={{ borderBottom: 'var(--br-card)' }}
      >
        <div
          className="flex overflow-hidden shrink-0"
          style={{
            background: 'var(--canvas-dark-200)',
            borderRadius: 'var(--r-pill)',
            border: 'var(--br-card)',
            padding: '3px',
          }}
        >
          {Object.entries(SORT_LABELS).map(([key, { label }]) => (
            <button
              key={key}
              type="button"
              onClick={() => setParam('sort', key)}
              className="inline-flex items-center px-4 h-7 text-[12px] font-semibold transition-colors cursor-pointer"
              style={{
                ...(currentSort === key ? segActive : segIdle),
                borderRadius: 'var(--r-pill)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          className="w-px h-6 shrink-0"
          style={{ background: 'oklch(1 0 0 / 0.08)' }}
        />

        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setParam('genre', null)}
            className="inline-flex items-center px-3 h-7 text-[11px] font-semibold transition-colors cursor-pointer"
            style={{
              ...(currentGenre ? segIdle : segActive),
              borderRadius: 'var(--r-pill)',
              background: currentGenre
                ? 'var(--canvas-dark-300)'
                : 'var(--brand)',
            }}
          >
            All Genres
          </button>
          {GENRES.map((genre) => {
            const isActive = currentGenre === genre.toLowerCase()
            return (
              <button
                key={genre}
                type="button"
                onClick={() => setParam('genre', genre.toLowerCase())}
                className="inline-flex items-center px-3 h-7 text-[11px] font-semibold transition-colors cursor-pointer"
                style={{
                  background: isActive
                    ? 'var(--brand)'
                    : 'var(--canvas-dark-300)',
                  color: isActive
                    ? 'var(--brand-ink)'
                    : 'var(--canvas-dark-ink-muted)',
                  borderRadius: 'var(--r-pill)',
                }}
              >
                {isActive ? `${genre} ✕` : genre}
              </button>
            )
          })}
        </div>
      </div>

      <div
        className="px-6 py-2.5"
        style={{
          background: 'var(--canvas-dark-150)',
          borderBottom: 'var(--br-card)',
        }}
      >
        <p
          className="text-[12px]"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          <span
            style={{
              color: 'var(--canvas-dark-ink-strong)',
              fontWeight: 600,
            }}
          >
            {sortInfo.label}
          </span>{' '}
          · {sortInfo.description}
        </p>
      </div>
    </div>
  )
}
