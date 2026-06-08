'use client'
import { useEffect, useState, useTransition } from 'react'
import { searchUsersAction } from '@/lib/actions/friendships.actions'

// Return shape verified against lib/actions/friendships.actions.ts:370-411 — matches exactly.
type Result = { userId: string; username: string; displayName: string | null; avatarUrl: string | null }

type Props = {
  isActive: boolean
  query: string
  anchorRect: DOMRect | null
  onPick: (user: Result) => void
  onClose: () => void
}

export function MentionPopover({ isActive, query, anchorRect, onPick, onClose }: Props) {
  const [results, setResults] = useState<Result[]>([])
  const [hoveredIndex, setHoveredIndex] = useState(0)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (!isActive) {
      setResults([])
      return
    }
    const handle = setTimeout(() => {
      startTransition(async () => {
        const result = await searchUsersAction({ query, limit: 6 })
        if (result.success) {
          setResults(result.data as Result[])
          setHoveredIndex(0)
        }
      })
    }, 300)
    return () => clearTimeout(handle)
  }, [isActive, query])

  useEffect(() => {
    if (!isActive) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHoveredIndex((i) => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHoveredIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        if (results[hoveredIndex]) {
          e.preventDefault()
          onPick(results[hoveredIndex])
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isActive, results, hoveredIndex, onPick, onClose])

  if (!isActive || !anchorRect || results.length === 0) return null

  return (
    <div
      className="fixed z-50 max-w-xs rounded-[var(--r-card)] border bg-[var(--canvas-dark-200)] shadow-[var(--sh-card)]"
      style={{
        top: anchorRect.bottom + 4,
        left: anchorRect.left,
        borderColor: 'var(--br-card)',
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <ul className="py-1">
        {results.map((u, i) => (
          <li key={u.userId}>
            <button
              type="button"
              onMouseEnter={() => setHoveredIndex(i)}
              onClick={() => onPick(u)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm"
              style={{
                background: i === hoveredIndex ? 'var(--canvas-dark-300)' : 'transparent',
                color: 'var(--canvas-dark-ink)',
              }}
            >
              {u.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
              ) : (
                <span
                  className="h-6 w-6 rounded-full"
                  style={{ background: 'var(--canvas-dark-300)' }}
                />
              )}
              <span className="font-medium">@{u.username}</span>
              {u.displayName && (
                <span className="text-xs text-[var(--canvas-dark-ink-muted)] truncate">
                  {u.displayName}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
