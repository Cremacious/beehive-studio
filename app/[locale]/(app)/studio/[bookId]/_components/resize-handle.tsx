'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  side: 'left' | 'right'
  isDragging: boolean
  onPointerDown: (e: React.PointerEvent) => void
  ariaLabel: string
}

// Vertical drag handle between two studio columns. The divider must READ as
// draggable without prose (issue #44): a faint resting hairline so the seam is
// visible, a centered grip (three dots) that brightens on hover, a col-resize
// cursor, and a brand highlight while hovering or dragging.
//
// The hit area is 6px wide (w-1.5); the visible rule + grip are centered inside.
// forwardRef so a coach mark can anchor to the handle.
export const ResizeHandle = forwardRef<HTMLDivElement, Props>(function ResizeHandle(
  { side, isDragging, onPointerDown, ariaLabel },
  ref,
) {
  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      title="Drag to resize"
      onPointerDown={onPointerDown}
      data-resize-handle={side}
      className={cn(
        'group flex-shrink-0 w-1.5 cursor-col-resize relative select-none',
      )}
      style={{ touchAction: 'none' }}
    >
      {/* Resting hairline: always visible so the seam reads as a divider.
          Brightens to brand on hover / drag. */}
      <div
        className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px transition-colors duration-150"
        style={{
          background: isDragging ? 'var(--brand)' : 'oklch(1 0 0 / 0.08)',
        }}
      />
      <div
        className={cn(
          'absolute inset-y-0 left-1/2 -translate-x-1/2 w-px transition-opacity duration-150',
          isDragging ? 'opacity-0' : 'opacity-0 group-hover:opacity-100',
        )}
        style={{ background: 'var(--brand)' }}
      />

      {/* Grip dots: the discoverability cue. Faint at rest, brand on hover/drag. */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-[3px] transition-opacity duration-150"
        aria-hidden="true"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block rounded-full transition-colors duration-150"
            style={{
              width: 3,
              height: 3,
              background: isDragging
                ? 'var(--brand)'
                : 'var(--canvas-dark-ink-muted)',
            }}
          />
        ))}
      </div>
    </div>
  )
})
