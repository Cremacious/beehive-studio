'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { OutlineCard } from '@/lib/outline/board'

type Props = {
  card: OutlineCard
  onChange: (patch: Partial<OutlineCard>) => void
  onDelete: () => void
  onOpenLinkPopover: () => void   // wired in Task 4
  onUnlink: () => void
  onJumpToChapter: () => void
  chapterAvailable: boolean
}

export function OutlineCardView({
  card, onChange, onDelete, onOpenLinkPopover, onUnlink, onJumpToChapter, chapterAvailable,
}: Props) {
  const [editingSynopsis, setEditingSynopsis] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="bg-surface-elevated border border-border rounded-md p-3 flex flex-col gap-2 group relative">
      {/* Title */}
      <input
        type="text"
        value={card.title}
        onChange={e => onChange({ title: e.target.value })}
        placeholder="Card title"
        className="bg-transparent text-sm font-medium text-foreground outline-none placeholder-muted-foreground"
      />

      {/* Synopsis */}
      {editingSynopsis ? (
        <textarea
          autoFocus
          value={card.synopsis ?? ''}
          onChange={e => onChange({ synopsis: e.target.value })}
          onBlur={() => setEditingSynopsis(false)}
          onKeyDown={e => { if (e.key === 'Escape') setEditingSynopsis(false) }}
          placeholder="Add a synopsis…"
          rows={4}
          className="resize-none bg-surface-inset border border-border rounded p-2 text-xs text-foreground/80 outline-none focus:border-brand/40"
        />
      ) : (
        <p
          onClick={() => setEditingSynopsis(true)}
          className={cn(
            'text-xs leading-relaxed cursor-text line-clamp-3 min-h-[2.5em]',
            card.synopsis ? 'text-foreground/70' : 'text-muted-foreground/50 italic',
          )}
        >
          {card.synopsis || 'Add a synopsis…'}
        </p>
      )}

      {/* Chapter link */}
      {card.linkedChapterId && (
        <button
          onClick={onJumpToChapter}
          className={cn(
            'text-[11px] text-left hover:underline',
            chapterAvailable ? 'text-brand' : 'text-destructive/70',
          )}
        >
          {chapterAvailable ? '→ View chapter' : '→ Chapter unavailable'}
        </button>
      )}

      {/* ⋯ menu trigger */}
      <button
        onClick={() => setMenuOpen(o => !o)}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground text-xs px-1"
        aria-label="Card actions"
      >
        ⋯
      </button>

      {menuOpen && (
        <div className="absolute top-7 right-2 bg-surface-elevated border border-border rounded-md shadow-lg p-1 w-44 z-10">
          {!card.linkedChapterId ? (
            <button
              onClick={() => { setMenuOpen(false); onOpenLinkPopover() }}
              className="block w-full text-left text-xs px-2 py-1.5 rounded hover:bg-surface text-foreground/80 hover:text-foreground"
            >
              Link to chapter…
            </button>
          ) : (
            <button
              onClick={() => { setMenuOpen(false); onUnlink() }}
              className="block w-full text-left text-xs px-2 py-1.5 rounded hover:bg-surface text-foreground/80 hover:text-foreground"
            >
              Unlink chapter
            </button>
          )}
          <button
            onClick={() => { setMenuOpen(false); onDelete() }}
            className="block w-full text-left text-xs px-2 py-1.5 rounded hover:bg-surface text-destructive hover:text-destructive"
          >
            Delete card
          </button>
        </div>
      )}
    </div>
  )
}
