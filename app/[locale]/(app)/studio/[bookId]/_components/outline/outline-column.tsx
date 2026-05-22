'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { OutlineCard, OutlineColumn } from '@/lib/outline/board'
import { OutlineCardView } from './outline-card'

type Props = {
  column: OutlineColumn
  onChange: (patch: Partial<OutlineColumn>) => void
  onDelete: () => void
  onAddCard: () => void
  onCardChange: (cardId: string, patch: Partial<OutlineCard>) => void
  onCardDelete: (cardId: string) => void
  onCardOpenLinkPopover: (cardId: string) => void
  onCardUnlink: (cardId: string) => void
  onCardJumpToChapter: (cardId: string) => void
  isChapterAvailable: (chapterId: string | undefined) => boolean
}

export function OutlineColumnView({
  column, onChange, onDelete, onAddCard,
  onCardChange, onCardDelete, onCardOpenLinkPopover, onCardUnlink, onCardJumpToChapter, isChapterAvailable,
}: Props) {
  const [renaming, setRenaming] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex flex-col gap-2 w-72 flex-shrink-0 bg-card border border-border rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        {renaming ? (
          <input
            autoFocus
            defaultValue={column.title}
            onBlur={e => { onChange({ title: e.target.value.trim() || column.title }); setRenaming(false) }}
            onKeyDown={e => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') setRenaming(false)
            }}
            className="flex-1 bg-transparent text-sm font-semibold text-foreground border-b border-brand outline-none"
          />
        ) : (
          <h3
            onDoubleClick={() => setRenaming(true)}
            className="flex-1 text-sm font-semibold text-foreground cursor-pointer hover:text-brand transition-colors truncate"
            title="Double-click to rename"
          >
            {column.title}
          </h3>
        )}

        <button
          onClick={() => setMenuOpen(o => !o)}
          className="text-muted-foreground hover:text-foreground text-xs px-1"
          aria-label="Column actions"
        >
          ⋯
        </button>
      </div>

      {menuOpen && !confirmingDelete && (
        <button
          onClick={() => { setMenuOpen(false); setConfirmingDelete(true) }}
          className="text-xs text-left text-destructive hover:underline px-1"
        >
          Delete column
        </button>
      )}

      {confirmingDelete && (
        <div className="text-xs px-1 py-1 flex flex-col gap-1.5">
          <span className="text-foreground/80">Delete column? Cards inside will be lost.</span>
          <div className="flex gap-3">
            <button onClick={onDelete} className="text-destructive font-medium hover:underline">Yes, delete</button>
            <button onClick={() => setConfirmingDelete(false)} className="text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        </div>
      )}

      {/* Cards */}
      <div className="flex flex-col gap-2">
        {column.cards.map(card => (
          <OutlineCardView
            key={card.id}
            card={card}
            onChange={patch => onCardChange(card.id, patch)}
            onDelete={() => onCardDelete(card.id)}
            onOpenLinkPopover={() => onCardOpenLinkPopover(card.id)}
            onUnlink={() => onCardUnlink(card.id)}
            onJumpToChapter={() => onCardJumpToChapter(card.id)}
            chapterAvailable={isChapterAvailable(card.linkedChapterId)}
          />
        ))}
      </div>

      <button
        onClick={onAddCard}
        className={cn(
          'text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md py-2 transition-colors',
        )}
      >
        + Add card
      </button>
    </div>
  )
}
