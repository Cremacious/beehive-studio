'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'

const GENRES = ['Fantasy', 'Sci-Fi', 'Romance', 'Thriller', 'Horror', 'Mystery', 'Literary', 'Historical']

const SORT_LABELS: Record<string, { label: string; description: string }> = {
  trending: { label: '🔥 Trending', description: 'Books gaining the most likes and readers this week' },
  popular: { label: '⭐ Popular', description: 'All-time community favorites' },
  new: { label: '✨ New', description: 'Freshest uploads — straight from the hive' },
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

  return (
    <div>
      <div className="px-6 py-4 flex items-center gap-3 flex-wrap border-b border-[#2a2a2a]">
        <div className="flex bg-[#1e1e1e] border border-[#2a2a2a] rounded-md overflow-hidden shrink-0">
          {Object.entries(SORT_LABELS).map(([key, { label }]) => (
            <button
              key={key}
              onClick={() => setParam('sort', key)}
              className={`px-4 py-1.5 text-xs font-medium border-l border-[#2a2a2a] first:border-l-0 transition-colors cursor-pointer ${
                currentSort === key
                  ? 'bg-[#FFC300] text-black font-semibold'
                  : 'bg-transparent text-[#888] hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-[#2a2a2a] shrink-0" />

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setParam('genre', null)}
            className={`px-3 py-1 rounded-full text-xs transition-colors cursor-pointer ${
              !currentGenre ? 'bg-[#FFC300] text-black font-semibold' : 'bg-[#2a2a2a] text-[#aaa] hover:text-white'
            }`}
          >
            All Genres
          </button>
          {GENRES.map(genre => (
            <button
              key={genre}
              onClick={() => setParam('genre', genre.toLowerCase())}
              className={`px-3 py-1 rounded-full text-xs transition-colors cursor-pointer ${
                currentGenre === genre.toLowerCase()
                  ? 'bg-[#FFC300] text-black font-semibold'
                  : 'bg-[#2a2a2a] text-[#aaa] hover:text-white'
              }`}
            >
              {currentGenre === genre.toLowerCase() ? `${genre} ✕` : genre}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-2.5 bg-[#181818] border-b border-[#2a2a2a]">
        <p className="text-xs text-[#888]">
          <span className="text-[#aaa] font-medium">{sortInfo.label}</span> — {sortInfo.description}
        </p>
      </div>
    </div>
  )
}
