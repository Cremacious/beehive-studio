'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import {
  searchUsersAction,
  type UserSearchResult,
} from '@/lib/actions/friendships.actions'
import { Avatar } from './shared'

type Props = {
  locale: string
}

export function UserSearch({ locale }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 300ms debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    if (trimmed.length < 1) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const r = await searchUsersAction({ query: trimmed, limit: 8 })
        if (r.success) setResults(r.data)
        else setResults([])
      })
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // Close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const showPopover = open && query.trim().length > 0

  return (
    <div ref={containerRef} className="relative w-full sm:w-[280px]">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search writers…"
          aria-label="Search writers by name or username"
          className="w-full pl-9 pr-3 py-2 text-[13px] rounded-[var(--r-row)] outline-none"
          style={{
            background: 'var(--canvas-dark-100)',
            color: 'var(--canvas-dark-ink)',
            boxShadow: 'var(--sh-inset)',
          }}
        />
      </div>
      {showPopover && (
        <div
          role="listbox"
          className="absolute left-0 right-0 mt-1 z-20 max-h-[320px] overflow-y-auto p-1"
          style={{
            background:
              'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            boxShadow: 'var(--sh-card)',
            border: '1px solid var(--br-card)',
            borderRadius: 'var(--r-card)',
          }}
        >
          {results.length === 0 ? (
            <div
              className="px-3 py-2 text-[12px]"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              No matches
            </div>
          ) : (
            <ul className="flex flex-col">
              {results.map((u) => {
                const label = u.displayName ?? u.username ?? 'Unknown'
                return (
                  <li key={u.userId}>
                    <Link
                      href={u.username ? `/${locale}/u/${u.username}` : '#'}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-[var(--r-row)] no-underline hover:bg-[var(--canvas-dark-300)]"
                    >
                      <Avatar url={u.avatarUrl} label={label} size={28} />
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[13px] font-medium truncate"
                          style={{ color: 'var(--canvas-dark-ink-strong)' }}
                        >
                          {label}
                        </p>
                        {u.username && (
                          <p
                            className="text-[11px] truncate"
                            style={{ color: 'var(--canvas-dark-ink-muted)' }}
                          >
                            @{u.username}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
