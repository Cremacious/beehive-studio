'use client'

import { useState } from 'react'
import { Pin, Star, Palette, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { NOTE_COLORS, NOTE_COLOR_HEX, type NoteColor } from '@/lib/notes/note-content'

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
  const [colorOpen, setColorOpen] = useState(false)

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {/* Pin */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onPinChange(!pinned)}
              className={cn(
                'p-1.5 rounded transition-colors',
                pinned
                  ? 'bg-brand/20 text-brand'
                  : 'text-foreground/60 hover:text-foreground hover:bg-surface-elevated',
              )}
            >
              <Pin size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent>{pinned ? 'Unpin from top' : 'Pin to top'}</TooltipContent>
        </Tooltip>

        {/* Color picker */}
        <Popover open={colorOpen} onOpenChange={setColorOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    'p-1.5 rounded transition-colors text-foreground/60 hover:text-foreground hover:bg-surface-elevated relative',
                  )}
                >
                  <Palette size={14} />
                  {color && (
                    <span
                      className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full border border-surface"
                      style={{ backgroundColor: NOTE_COLOR_HEX[color] }}
                    />
                  )}
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Color tag</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-auto p-2" align="end">
            <div className="flex items-center gap-1.5">
              {NOTE_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => { onColorChange(c); setColorOpen(false) }}
                  className="w-6 h-6 rounded-full border border-border hover:scale-110 transition-transform flex items-center justify-center"
                  style={{ backgroundColor: NOTE_COLOR_HEX[c] }}
                  title={c}
                >
                  {color === c && <Check size={12} className="text-background" />}
                </button>
              ))}
              <button
                onClick={() => { onColorChange(null); setColorOpen(false) }}
                className="text-xs px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface-elevated ml-1"
              >
                Clear
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Favorite */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onFavoriteChange(!favorited)}
              className={cn(
                'p-1.5 rounded transition-colors',
                favorited
                  ? 'bg-brand/20 text-brand'
                  : 'text-foreground/60 hover:text-foreground hover:bg-surface-elevated',
              )}
            >
              <Star size={14} fill={favorited ? 'currentColor' : 'none'} />
            </button>
          </TooltipTrigger>
          <TooltipContent>{favorited ? 'Remove favorite' : 'Mark as favorite'}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
