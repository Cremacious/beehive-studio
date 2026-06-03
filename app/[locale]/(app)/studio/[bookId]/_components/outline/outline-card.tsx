'use client'

/* OutlineBeatRow — one beat in the act drawer. Compact iOS-table row
 * with: drag handle · index · color dot · title (button → dialog) ·
 * label badge · link chip. Clicking the title or color dot opens the
 * beat dialog (parent-owned); delete lives in the dialog. */

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Link as LinkIcon, Link2Off } from 'lucide-react'
import type { Beat } from './outline-board'
import { BeatLabelBadge } from './beat-label-badge'

type Props = {
  beat: Beat
  index: number
  isLast: boolean
  chapterAvailable: boolean
  chapterTitle: string | null
  onEditClick?: (beat: Beat) => void
  onOpenLinkPopover: () => void
  onUnlink: () => void
  onJumpToChapter: () => void
}

export function OutlineBeatRow({
  beat, index, isLast, chapterAvailable, chapterTitle,
  onEditClick, onOpenLinkPopover, onUnlink, onJumpToChapter,
}: Props) {
  const sortable = useSortable({ id: beat.id })

  const rowStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.45 : 1,
    display: 'grid',
    gridTemplateColumns: '28px 26px 14px 1fr auto',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderBottom: isLast ? 0 : '1px solid var(--outline-rule)',
    color: 'var(--outline-ink)',
    background: sortable.isDragging
      ? 'oklch(from var(--color-brand) l c h / 0.06)'
      : 'transparent',
  }

  return (
    <div ref={sortable.setNodeRef} style={rowStyle} data-slot="beat-row">
      <button
        type="button"
        ref={sortable.setActivatorNodeRef}
        {...sortable.attributes}
        {...sortable.listeners}
        aria-label="Drag to reorder · drag into another act to move"
        title="Drag to reorder · drag into another act to move"
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

      <span
        aria-label={`Beat ${index}`}
        style={{
          width: 26, height: 22,
          display: 'grid', placeItems: 'center',
          borderRadius: 11,
          background: 'oklch(from var(--outline-ink-muted) l c h / 0.12)',
          color: 'var(--outline-ink-muted)',
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {index}
      </span>

      <button
        type="button"
        onClick={() => onEditClick?.(beat)}
        aria-label={`Edit beat: ${beat.title || 'untitled'}`}
        title={beat.color ? `Color: ${beat.color}` : 'Edit beat'}
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: beat.color ? `var(--beat-${beat.color})` : 'transparent',
          border: beat.color ? '0' : '1px dashed var(--outline-rule)',
          cursor: 'pointer',
          padding: 0,
          flexShrink: 0,
        }}
      />

      <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          onClick={() => onEditClick?.(beat)}
          aria-label={`Edit beat: ${beat.title || 'untitled'}`}
          className="text-left font-comfortaa font-semibold text-sm hover:underline"
          style={{
            background: 'transparent',
            border: 0,
            color: 'var(--outline-ink-strong)',
            padding: 0,
            cursor: 'pointer',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {beat.title || <span style={{ fontStyle: 'italic', opacity: 0.55 }}>Untitled beat</span>}
        </button>
        <BeatLabelBadge label={beat.label} />
      </div>

      {beat.linkedChapterId && chapterAvailable ? (
        <button
          type="button"
          onClick={onJumpToChapter}
          title={`Linked to ${chapterTitle ?? 'chapter'} · click to jump`}
          aria-label={`Linked to ${chapterTitle ?? 'chapter'}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            borderRadius: 6,
            background: 'oklch(from var(--color-brand) l c h / 0.12)',
            color: 'var(--outline-ink)',
            border: 0,
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            maxWidth: 140,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          <LinkIcon className="w-3 h-3" />
          {chapterTitle ?? 'Chapter'}
        </button>
      ) : beat.linkedChapterId ? (
        <button
          type="button"
          onClick={onUnlink}
          title="Linked chapter is missing · click to unlink"
          aria-label="Unlink missing chapter"
          style={{ ...linkButtonBase, color: 'var(--outline-ink-muted)' }}
        >
          <Link2Off className="w-3 h-3" />
          Missing
        </button>
      ) : (
        <button
          type="button"
          onClick={onOpenLinkPopover}
          title="Link this beat to a chapter"
          aria-label="Link to a chapter"
          style={{
            ...linkButtonBase,
            color: 'var(--outline-ink-muted)',
            opacity: 0.6,
          }}
        >
          <LinkIcon className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

const linkButtonBase: React.CSSProperties = {
  width: 28,
  height: 28,
  display: 'grid',
  placeItems: 'center',
  background: 'transparent',
  border: 0,
  cursor: 'pointer',
  borderRadius: 6,
}
