'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { useBookEditor } from '../book-editor-provider'

type Props = {
  onPick: (chapterId: string) => void
  onClose: () => void
}

// DP3 Task 4 — visual port to match the specialized-surfaces mockup
// (§9 Linking a beat). Behavior preserved: search by title, list of chapter
// binder items, click to pick, Esc / overlay / × to close.
export function ChapterLinkPopover({ onPick, onClose }: Props) {
  const { binderItems } = useBookEditor()
  const [query, setQuery] = useState('')

  const chapters = binderItems
    .filter(b => b.type === 'chapter' && b.chapterId)
    .sort((a, b) => a.order - b.order)

  const filtered = query.trim()
    ? chapters.filter(c => (c.title ?? '').toLowerCase().includes(query.trim().toLowerCase()))
    : chapters

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh] bg-black/55 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={e => { if (e.key === 'Escape') onClose() }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="rounded-lg shadow-2xl max-w-md w-full max-h-[60vh] flex flex-col"
        style={{
          width: 360,
          background: 'var(--canvas-dark-100, oklch(0.255 0.018 55))',
          border: '1px solid var(--canvas-dark-300, oklch(0.350 0.018 55))',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between gap-2 px-3 py-2.5"
          style={{ borderBottom: '1px solid var(--canvas-dark-300, oklch(0.350 0.018 55))' }}
        >
          <span
            className="text-[10px] font-mono uppercase tracking-[0.10em]"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            Link to chapter
          </span>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded p-1"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pt-3 pb-2">
          <div
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md"
            style={{
              background: 'var(--canvas-dark-200, oklch(0.290 0.018 55))',
              border: '1px solid var(--canvas-dark-300, oklch(0.350 0.018 55))',
            }}
          >
            <Search className="w-3.5 h-3.5" style={{ color: 'var(--canvas-dark-ink-muted)' }} />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search chapters…"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: 'var(--canvas-dark-ink)' }}
            />
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <p
            className="px-4 pb-4 text-xs italic"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            {chapters.length === 0
              ? 'No chapters in this book yet. Add a chapter from the binder first.'
              : 'No chapters match that search.'}
          </p>
        ) : (
          <div className="overflow-y-auto flex flex-col gap-0.5 px-2 pb-3">
            {filtered.map(c => (
              <button
                key={c.id}
                onClick={() => { onPick(c.chapterId!); onClose() }}
                className="text-left text-sm px-2.5 py-2 rounded transition-colors"
                style={{ color: 'var(--canvas-dark-ink)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--canvas-dark-200, oklch(0.290 0.018 55))' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                {c.title || 'Untitled chapter'}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
