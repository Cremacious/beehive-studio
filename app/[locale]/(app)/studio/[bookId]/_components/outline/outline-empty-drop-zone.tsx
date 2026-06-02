'use client'

/* OutlineEmptyDropZone — dashed "Drop a beat here" zone rendered inside any
 * act with 0 beats. Becomes brand-tinted on dragOver. */

import { useDroppable } from '@dnd-kit/core'

export function OutlineEmptyDropZone({
  actKey,
}: {
  actKey: string | null
}) {
  // Stable id: __empty__:<actKey> — outline-board's onDragEnd parses this.
  const id = `__empty__:${actKey ?? '__noact__'}`
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      role="region"
      aria-label={
        actKey ? `Drop a beat into ${actKey}` : 'Drop a beat into No Act'
      }
      style={{
        minHeight: 48,
        margin: '8px 12px',
        borderRadius: 8,
        display: 'grid',
        placeItems: 'center',
        fontSize: 12,
        fontStyle: 'italic',
        textAlign: 'center',
        color: isOver
          ? 'var(--outline-ink)'
          : 'var(--outline-ink-muted)',
        background: isOver
          ? 'oklch(from var(--color-brand) l c h / 0.08)'
          : 'transparent',
        border: isOver
          ? '1.5px solid oklch(from var(--color-brand) l c h / 0.55)'
          : '1.5px dashed var(--outline-rule-soft)',
        transition: 'background 150ms ease, border-color 150ms ease, color 150ms ease',
      }}
    >
      ⋯ Drop a beat here, or click <strong>+ Add</strong> ⋯
    </div>
  )
}
