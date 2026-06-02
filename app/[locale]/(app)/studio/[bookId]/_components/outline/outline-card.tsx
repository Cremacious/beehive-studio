'use client'

/* OutlineBeatRow — one beat in the act drawer. Compact iOS-table row
 * with: drag handle · index · status dot · title (editable) · description
 * (editable, optional) · link chip · delete. */

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Link as LinkIcon, Link2Off } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { Beat, BeatStatus } from './outline-board'

type Props = {
  beat: Beat
  index: number
  isLast: boolean
  chapterAvailable: boolean
  chapterTitle: string | null
  onChange: (patch: Partial<Beat>) => void
  onDelete: () => void
  onCycleStatus: () => void
  onOpenLinkPopover: () => void
  onUnlink: () => void
  onJumpToChapter: () => void
}

const STATUS_COLOR: Record<BeatStatus, string> = {
  idea: 'oklch(0.78 0.04 240)',
  drafting: 'oklch(0.78 0.16 80)',
  done: 'oklch(0.70 0.16 145)',
}
const STATUS_LABEL: Record<BeatStatus, string> = {
  idea: 'idea',
  drafting: 'drafting',
  done: 'done',
}

export function OutlineBeatRow({
  beat, index, isLast, chapterAvailable, chapterTitle,
  onChange, onDelete, onCycleStatus, onOpenLinkPopover, onUnlink, onJumpToChapter,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const sortable = useSortable({ id: beat.id })

  const rowStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.45 : 1,
    display: 'grid',
    gridTemplateColumns: '28px 26px 14px 1fr auto auto',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderBottom: isLast ? 0 : '1px solid var(--outline-rule)',
    color: 'var(--outline-ink)',
    background: sortable.isDragging
      ? 'oklch(from var(--color-brand) l c h / 0.06)'
      : 'transparent',
  }

  const status: BeatStatus = beat.status ?? 'idea'

  return (
    <>
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
          onClick={onCycleStatus}
          aria-label={`Status: ${STATUS_LABEL[status]} · click to cycle`}
          title={`Status: ${STATUS_LABEL[status]} · click to cycle (idea → drafting → done)`}
          style={{
            width: 14, height: 14,
            borderRadius: 7,
            background: STATUS_COLOR[status],
            border: '1.5px solid var(--outline-drawer-bg)',
            boxShadow: '0 0 0 1px var(--outline-rule)',
            cursor: 'pointer',
            padding: 0,
          }}
        />

        <div style={{ minWidth: 0 }}>
          <input
            type="text"
            value={beat.title}
            placeholder="Untitled beat"
            onChange={e => onChange({ title: e.target.value })}
            style={{
              width: '100%',
              background: 'transparent',
              border: 0,
              outline: 'none',
              color: 'var(--outline-ink-strong)',
              fontSize: 13,
              fontWeight: 600,
              padding: 0,
              fontFamily: 'inherit',
            }}
          />
          {beat.description ? (
            <input
              type="text"
              value={beat.description}
              placeholder="Notes…"
              onChange={e => onChange({ description: e.target.value })}
              style={{
                width: '100%',
                background: 'transparent',
                border: 0,
                outline: 'none',
                color: 'var(--outline-ink-muted)',
                fontSize: 12,
                padding: '2px 0 0',
                fontFamily: 'inherit',
              }}
            />
          ) : null}
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

        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          title="Delete beat"
          aria-label="Delete beat"
          style={{
            width: 28, height: 28,
            display: 'grid', placeItems: 'center',
            background: 'transparent', border: 0,
            color: 'var(--outline-ink-muted)',
            cursor: 'pointer',
            borderRadius: 6,
            opacity: 0.7,
          }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        variant="destructive"
        title="Delete this beat?"
        description="This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirmOpen(false)
          onDelete()
        }}
      />
    </>
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
