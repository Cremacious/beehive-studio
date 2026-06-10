'use client'

import { useDroppable } from '@dnd-kit/core'

/**
 * A dashed-outline rectangle between two binder rows. Only mounts during a
 * drag. The `id` encodes the insert position as `slot:<parentId|ROOT>:<index>`
 * so handleDragEnd can resolve it back into a parent + index for the data
 * update. When the dragged item is hovering this slot, the outline turns
 * solid brand-yellow with a tinted fill — the exact spot the item will land.
 */
export function BinderSlot({
  id,
  depth,
}: {
  id: string
  depth: number
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      aria-hidden
      style={{
        height: '22px',
        margin: '3px 8px',
        marginLeft: `${8 + depth * 12}px`,
        marginRight: '8px',
        borderRadius: '10px',
        border: isOver
          ? '1.5px dashed var(--brand)'
          : '1.5px dashed rgba(255,255,255,0.18)',
        background: isOver
          ? 'oklch(from var(--brand) l c h / 0.18)'
          : 'rgba(255,255,255,0.02)',
        boxShadow: isOver
          ? 'inset 0 0 0 1px oklch(from var(--brand) l c h / 0.35)'
          : undefined,
        transition: 'border-color .1s, background .1s, box-shadow .1s',
      }}
    />
  )
}
