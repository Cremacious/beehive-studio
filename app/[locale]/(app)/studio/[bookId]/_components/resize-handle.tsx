'use client'

import { cn } from '@/lib/utils'

type Props = {
  side: 'left' | 'right'
  isDragging: boolean
  onPointerDown: (e: React.PointerEvent) => void
  ariaLabel: string
}

// Thin vertical drag handle that sits between two flex columns. Visually a
// 1px brand line wrapped in a 6px hit-target. Cursor flips to col-resize on
// hover. Active drag highlights the bar in brand-yellow.
//
// The hit area is 6px wide; the visible bar is 1px centered. This gives users
// a forgiving grab zone without consuming horizontal space.
export function ResizeHandle({ side, isDragging, onPointerDown, ariaLabel }: Props) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      className={cn(
        'group flex-shrink-0 w-1.5 cursor-col-resize relative select-none',
        'transition-colors duration-150',
        isDragging && 'bg-transparent',
      )}
      style={{
        // 6px hit target; the visible rule is the inner div.
        touchAction: 'none',
      }}
      data-side={side}
    >
      <div
        className={cn(
          'absolute inset-y-0 left-1/2 -translate-x-1/2 w-px',
          'transition-colors duration-150',
        )}
        style={{
          background: isDragging
            ? 'var(--brand)'
            : 'transparent',
        }}
      />
      <div
        className={cn(
          'absolute inset-y-0 left-1/2 -translate-x-1/2 w-px opacity-0 group-hover:opacity-100',
          'transition-opacity duration-150',
        )}
        style={{ background: 'var(--brand)' }}
      />
    </div>
  )
}
