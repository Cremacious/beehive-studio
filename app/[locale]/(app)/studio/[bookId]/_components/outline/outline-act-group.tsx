'use client'

/* OutlineActGroup — collapsible act drawer (iOS-Settings-table feel).
 *
 * Structure:
 *   ┌─ Cap (tinted, top corners rounded) ──────────────┐
 *   │ ⋮⋮  ▼  Act name (editable)  3 beats   + Add     │
 *   └──────────────────────────────────────────────────┘
 *   ┌─ Drawer (white-ish, bottom corners rounded) ─────┐
 *   │  beat row                                        │
 *   │  beat row                                        │
 *   └──────────────────────────────────────────────────┘
 *
 * Owns its own per-act SortableContext for beat ordering. The outer
 * outline-board owns the SortableContext for act ordering. */

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { ChevronRight, GripVertical, Plus } from 'lucide-react'
import type { Beat } from './outline-board'
import { OutlineBeatRow } from './outline-card'
import { OutlineEmptyDropZone } from './outline-empty-drop-zone'

export type OutlineActGroupProps = {
  actKey: string | null  // null = "No Act"
  beats: Beat[]
  startIndex: number  // global 1-based index of first beat in this act
  collapsed: boolean
  onToggleCollapsed: () => void
  onRenameAct: (oldName: string, newName: string) => void
  onAddBeat: () => void
  onEditBeat: (beat: Beat) => void
  onOpenLinkPopover: (id: string) => void
  onUnlink: (id: string) => void
  onJumpToChapter: (chapterId: string) => void
  chapterAvailable: (id: string | null | undefined) => boolean
  chapterTitle: (id: string | null | undefined) => string | null
}

export function OutlineActGroup(props: OutlineActGroupProps) {
  const {
    actKey, beats, startIndex, collapsed,
    onToggleCollapsed, onRenameAct, onAddBeat,
    onEditBeat,
    onOpenLinkPopover, onUnlink, onJumpToChapter,
    chapterAvailable, chapterTitle,
  } = props

  const actId = `__act__:${actKey ?? '__noact__'}`
  const sortable = useSortable({ id: actId, data: { type: 'act' } })
  const dropToHeader = useDroppable({ id: `__acthead__:${actKey ?? '__noact__'}` })
  // Whole-drawer drop target — makes dropping a beat anywhere inside a
  // non-empty act work reliably, not just on the header strip.
  const dropToBody = useDroppable({ id: `__actbody__:${actKey ?? '__noact__'}` })

  // Section-level ring fires when EITHER the cap or the drawer body is over.
  const isActOver = dropToHeader.isOver || dropToBody.isOver

  const wrapperStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    // Compose sortable's transition with our ring transition so the highlight
    // animates smoothly when the dragged beat enters/leaves the act surface.
    transition: [sortable.transition, 'box-shadow 150ms ease']
      .filter(Boolean)
      .join(', '),
    opacity: sortable.isDragging ? 0.55 : 1,
    borderRadius: 10,
    boxShadow: isActOver
      ? '0 0 0 2px oklch(from var(--color-brand) l c h / 0.55)'
      : undefined,
  }

  return (
    <section ref={sortable.setNodeRef} style={wrapperStyle}>
      <header
        ref={dropToHeader.setNodeRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          background: 'var(--outline-act-cap-bg)',
          border: '1px solid var(--outline-rule)',
          borderBottom: collapsed ? '1px solid var(--outline-rule)' : 0,
          borderRadius: collapsed ? 10 : '10px 10px 0 0',
        }}
      >
        <button
          type="button"
          aria-label="Drag to reorder acts"
          title="Drag to reorder acts"
          ref={sortable.setActivatorNodeRef}
          {...sortable.attributes}
          {...sortable.listeners}
          style={{
            width: 28, height: 28,
            display: 'grid', placeItems: 'center',
            background: 'transparent', border: 0,
            color: 'var(--outline-ink-muted)',
            cursor: 'grab',
            borderRadius: 6,
          }}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand this act' : 'Collapse this act'}
          title={collapsed ? 'Expand this act' : 'Collapse this act'}
          onClick={onToggleCollapsed}
          style={{
            width: 28, height: 28,
            display: 'grid', placeItems: 'center',
            background: 'transparent', border: 0,
            color: 'var(--outline-ink-muted)',
            cursor: 'pointer',
            borderRadius: 6,
            transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
            transition: 'transform 150ms ease',
          }}
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {actKey === null ? (
          <span
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: 'var(--outline-ink-strong)',
              fontFamily: 'var(--font-display, inherit)',
            }}
          >
            No Act
          </span>
        ) : (
          <input
            defaultValue={actKey}
            placeholder="Act name"
            onBlur={e => onRenameAct(actKey, e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') {
                ;(e.target as HTMLInputElement).value = actKey
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            style={{
              fontWeight: 700,
              fontSize: 14,
              background: 'transparent',
              border: 0,
              borderBottom: '1px solid transparent',
              outline: 'none',
              color: 'var(--outline-ink-strong)',
              fontFamily: 'var(--font-display, inherit)',
              padding: '2px 0',
              minWidth: 0,
            }}
          />
        )}

        <span style={{ fontSize: 11, color: 'var(--outline-ink-strong)', fontWeight: 600 }}>
          {beats.length} beat{beats.length === 1 ? '' : 's'}
        </span>

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={onAddBeat}
          title={actKey ? `Add a beat to ${actKey}` : 'Add a beat to No Act'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 10px',
            borderRadius: 6,
            background: 'transparent',
            color: 'var(--outline-ink-muted)',
            border: 0,
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 700,
            minHeight: 28,
          }}
        >
          <Plus className="w-3 h-3" />
          Add beat
        </button>
      </header>

      {!collapsed ? (
        <div
          ref={dropToBody.setNodeRef}
          style={{
            background: 'var(--outline-drawer-bg)',
            border: '1px solid var(--outline-rule)',
            borderTop: 0,
            borderRadius: '0 0 10px 10px',
            overflow: 'hidden',
          }}
        >
          {beats.length === 0 ? (
            <OutlineEmptyDropZone actKey={actKey} />
          ) : (
            <SortableContext
              items={beats.map(b => b.id)}
              strategy={verticalListSortingStrategy}
            >
              {beats.map((beat, i) => {
                const idx = startIndex + i
                return (
                  <OutlineBeatRow
                    key={beat.id}
                    beat={beat}
                    index={idx}
                    isLast={i === beats.length - 1}
                    chapterAvailable={chapterAvailable(beat.linkedChapterId)}
                    chapterTitle={chapterTitle(beat.linkedChapterId)}
                    onEditClick={onEditBeat}
                    onOpenLinkPopover={() => onOpenLinkPopover(beat.id)}
                    onUnlink={() => onUnlink(beat.id)}
                    onJumpToChapter={() => {
                      if (beat.linkedChapterId) onJumpToChapter(beat.linkedChapterId)
                    }}
                  />
                )
              })}
            </SortableContext>
          )}
        </div>
      ) : null}
    </section>
  )
}
