'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Link as LinkIcon } from 'lucide-react'
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

// Status token map. Three tints from existing --status-* palette per spec §Task 4.
// idea → cloud blue · drafting → warm yellow · done → terracotta.
const STATUS_TOKEN: Record<BeatStatus, string> = {
  idea: '--status-idea',
  drafting: '--status-first-draft',
  done: '--status-final',
}

export function OutlineBeatRow({
  beat, index, isLast, chapterAvailable, chapterTitle,
  onChange, onDelete, onCycleStatus, onOpenLinkPopover, onUnlink, onJumpToChapter,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: beat.id })
  const rowStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const status: BeatStatus = beat.status ?? 'idea'
  const statusToken = STATUS_TOKEN[status]
  const linked = !!beat.linkedChapterId

  return (
    <div
      ref={setNodeRef}
      style={rowStyle}
      className="group relative grid gap-3 py-3 px-2 rounded-md transition-colors"
      data-slot="beat-row"
      // grid-template-columns: gutter (number + drag handle) | body
      // matches mockup .beat
    >
      <div
        className="grid"
        style={{ gridTemplateColumns: '42px 1fr', gap: 12, position: 'relative' }}
      >
        {/* Gutter: numbered pill + drag handle + connector line down */}
        <div
          className="flex flex-col items-center gap-1.5 pt-0.5 relative"
          aria-hidden
        >
          {/* connector line */}
          {!isLast && (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: '50%',
                top: 30,
                bottom: -16,
                width: 1,
                background: 'var(--sheet-rule-soft)',
                transform: 'translateX(-50%)',
              }}
            />
          )}
          <span
            className="inline-flex items-center justify-center font-mono font-semibold"
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              fontSize: 11,
              zIndex: 1,
              background: linked ? 'var(--color-brand)' : 'var(--sheet-bg)',
              color: linked ? 'var(--brand-ink, oklch(0.18 0.02 60))' : 'var(--sheet-ink-muted)',
              border: linked
                ? '1px solid var(--color-brand)'
                : '1px solid var(--sheet-rule)',
              boxShadow: linked
                ? '0 0 0 3px oklch(from var(--color-brand) l c h / 0.18)'
                : undefined,
            }}
          >
            {index}
          </span>
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
            aria-label="Drag beat"
            style={{ color: 'var(--sheet-ink-muted)' }}
          >
            <GripVertical className="w-3.5 h-4" />
          </button>
        </div>

        {/* Body card */}
        <div
          className="relative px-4 py-3 rounded-md"
          style={{
            background: 'var(--sheet-bg)',
            border: '1px solid var(--sheet-rule)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
          }}
        >
          {/* Title */}
          <h4
            contentEditable
            suppressContentEditableWarning
            onBlur={e => {
              const next = (e.currentTarget.textContent ?? '').trim()
              if (next !== (beat.title ?? '').trim()) onChange({ title: next })
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                ;(e.currentTarget as HTMLElement).blur()
              }
            }}
            className="m-0 outline-none"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--sheet-ink-strong)',
              lineHeight: 1.3,
              letterSpacing: '-0.005em',
            }}
            data-placeholder="Beat title"
          >
            {beat.title}
          </h4>

          {/* Description */}
          <div
            contentEditable
            suppressContentEditableWarning
            onBlur={e => {
              const next = (e.currentTarget.textContent ?? '').trim()
              if (next !== (beat.description ?? '').trim()) onChange({ description: next })
            }}
            className="mt-1.5 outline-none"
            style={{
              fontFamily: 'var(--font-prose)',
              fontSize: 14,
              lineHeight: 1.55,
              color: 'var(--sheet-ink-muted)',
              minHeight: '1.4em',
              whiteSpace: 'pre-wrap',
            }}
            data-placeholder="What happens in this beat?"
          >
            {beat.description ?? ''}
          </div>

          {/* Row: chapter chip + status pill */}
          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
            {/* Linked-chapter chip */}
            {linked ? (
              <button
                type="button"
                onClick={chapterAvailable ? onJumpToChapter : undefined}
                onDoubleClick={onUnlink}
                title={chapterAvailable ? 'Click to open · double-click to unlink' : 'Chapter unavailable · double-click to unlink'}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full"
                style={{
                  background: chapterAvailable
                    ? 'oklch(from var(--color-brand) l c h / 0.18)'
                    : 'oklch(from var(--destructive) l c h / 0.15)',
                  color: chapterAvailable
                    ? 'var(--color-brand)'
                    : 'var(--destructive)',
                  border: '1px solid oklch(from var(--color-brand) l c h / 0.28)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 11.5,
                }}
              >
                <LinkIcon className="w-2.5 h-2.5 opacity-60" />
                {chapterAvailable ? (chapterTitle ?? 'Linked chapter') : 'Chapter unavailable'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenLinkPopover}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full transition-colors"
                style={{
                  background: 'transparent',
                  color: 'var(--sheet-ink-muted)',
                  border: '1px dashed var(--sheet-rule)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 11.5,
                }}
              >
                <LinkIcon className="w-2.5 h-2.5 opacity-60" />
                Link chapter
              </button>
            )}

            {/* Status pill — clickable, cycles idea → drafting → done → idea */}
            <button
              type="button"
              onClick={onCycleStatus}
              title="Click to cycle status"
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono lowercase"
              style={{
                fontSize: 10.5,
                letterSpacing: '0.04em',
                color: `var(${statusToken})`,
                backgroundColor: `oklch(from var(${statusToken}) l c h / 0.18)`,
                borderColor: `oklch(from var(${statusToken}) l c h / 0.40)`,
                borderWidth: 1,
                borderStyle: 'solid',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 2,
                  background: `var(${statusToken})`,
                  display: 'inline-block',
                }}
              />
              {status}
            </button>
          </div>

          {/* Delete button — appears on hover */}
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete beat"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
            style={{ color: 'var(--sheet-ink-muted)' }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
