'use client'

import { Pin, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { NOTE_COLORS, NOTE_COLOR_HEX, type NoteColor } from '@/lib/notes/note-content'

// TODO(DP3 follow-up): the mockup includes a hashtag-style "tag chips" row
// with an "+ add tag" affordance. The current data model
// (lib/notes/note-content.ts) only stores pinned/color/favorited — no tags
// field. Tags are intentionally NOT shipped in this visual port. Adding
// them requires a ResearchNoteContent shape extension + UI; track separately.

type Props = {
  pinned: boolean
  color: NoteColor | null
  favorited: boolean
  onPinChange: (next: boolean) => void
  onColorChange: (next: NoteColor | null) => void
  onFavoriteChange: (next: boolean) => void
}

export function NoteAttributeControls({
  pinned, color, favorited,
  onPinChange, onColorChange, onFavoriteChange,
}: Props) {
  return (
    <TooltipProvider>
      <div
        data-slot="note-attrs"
        className="flex items-center flex-wrap gap-2"
      >
        {/* Color swatch row — pill container with 5 swatches + clear */}
        <div
          data-slot="note-swatchrow"
          className="inline-flex items-center gap-1 px-1.5 py-1 rounded-full border"
          style={{
            background: 'oklch(0.78 0.04 60 / 0.10)',
            borderColor: 'oklch(0.78 0.04 60 / 0.20)',
          }}
        >
          {NOTE_COLORS.map(c => {
            const active = color === c
            return (
              <Tooltip key={c}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onColorChange(active ? null : c)}
                    aria-label={`Color ${c}${active ? ' (active)' : ''}`}
                    aria-pressed={active}
                    className={cn(
                      'w-[14px] h-[14px] rounded-full transition-transform hover:scale-110',
                      'border-[1.5px]',
                    )}
                    style={{
                      backgroundColor: NOTE_COLOR_HEX[c],
                      borderColor: active ? 'var(--paper-ink-strong)' : 'transparent',
                      boxShadow: active ? '0 0 0 2px var(--paper-100)' : undefined,
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent className="capitalize">{c}</TooltipContent>
              </Tooltip>
            )
          })}
        </div>

        {/* Pin toggle — dashed pill off, solid brand-soft pill on */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onPinChange(!pinned)}
              aria-pressed={pinned}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide transition-colors',
                pinned
                  ? 'bg-brand-soft text-brand-active border border-brand/40'
                  : 'border border-dashed border-foreground/30 text-foreground/55 hover:text-foreground hover:border-foreground/50',
              )}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <Pin size={11} />
              {pinned ? 'Pinned' : 'Pin'}
            </button>
          </TooltipTrigger>
          <TooltipContent>{pinned ? 'Unpin from top' : 'Pin to top'}</TooltipContent>
        </Tooltip>

        {/* Favorite toggle — preserves current behavior (mockup omits it; we keep) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onFavoriteChange(!favorited)}
              aria-pressed={favorited}
              className={cn(
                'inline-flex items-center justify-center w-[28px] h-[28px] rounded-full transition-colors',
                favorited
                  ? 'bg-brand-soft text-brand-active'
                  : 'text-foreground/55 hover:text-foreground hover:bg-surface-elevated',
              )}
            >
              <Star size={13} fill={favorited ? 'currentColor' : 'none'} />
            </button>
          </TooltipTrigger>
          <TooltipContent>{favorited ? 'Remove favorite' : 'Mark as favorite'}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
