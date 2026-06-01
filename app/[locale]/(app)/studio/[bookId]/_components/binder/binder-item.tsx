'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { useBookEditor } from '../book-editor-provider'
import { useBinderTree, type TreeNode } from './binder-tree'
import { BinderItemMenu } from './binder-item-menu'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import type { ChapterStatus } from '@/lib/books/is-chapter-reader-visible'
import { NOTE_COLOR_HEX } from '@/lib/notes/note-content'
import {
  BookOpen,
  FileText,
  ScrollText,
  Folder,
  StickyNote,
  User as UserIcon,
  Layout as LayoutIcon,
  ChevronRight,
  GripVertical,
  Pin,
  Star,
  type LucideIcon,
} from 'lucide-react'

// ─── Note decorations ─────────────────────────────────────────────────────────

type NoteDecorations = {
  colorHex: string | null
  pinned: boolean
  favorited: boolean
}

function getNoteDecorations(item: BinderItemRow): NoteDecorations {
  if (item.type !== 'research_note') {
    return { colorHex: null, pinned: false, favorited: false }
  }
  const c = item.content
  if (!c || typeof c !== 'object' || Array.isArray(c)) {
    return { colorHex: null, pinned: false, favorited: false }
  }
  const obj = c as { pinned?: boolean; color?: string; favorited?: boolean }
  const colorHex = obj.color && obj.color in NOTE_COLOR_HEX
    ? NOTE_COLOR_HEX[obj.color as keyof typeof NOTE_COLOR_HEX]
    : null
  return {
    colorHex,
    pinned: obj.pinned === true,
    favorited: obj.favorited === true,
  }
}

// ─── Icon mapping ─────────────────────────────────────────────────────────────

const ICONS: Record<BinderItemRow['type'], LucideIcon> = {
  part: BookOpen,
  chapter: FileText,
  front_matter: ScrollText,
  back_matter: ScrollText,
  research_folder: Folder,
  research_note: StickyNote,
  character: UserIcon,
  outline: LayoutIcon,
  wiki_entry: BookOpen,
  wiki_folder: Folder,
}

const ICON_TINTS: Record<BinderItemRow['type'], string> = {
  part: 'var(--type-chapter)',
  chapter: 'var(--type-chapter)',
  front_matter: 'var(--type-front-matter)',
  back_matter: 'var(--type-back-matter)',
  research_folder: 'var(--type-research)',
  research_note: 'var(--type-research)',
  character: 'var(--type-character)',
  outline: 'var(--type-outline)',
  wiki_entry: 'var(--wiki-other)',
  wiki_folder: 'var(--wiki-other)',
}

const COLLAPSIBLE_TYPES = new Set<BinderItemRow['type']>(['part', 'research_folder', 'wiki_folder'])

const STATUS_COLOR: Record<ChapterStatus, string> = {
  IDEA: 'var(--status-idea)',
  OUTLINE: 'var(--status-outline)',
  FIRST_DRAFT: 'var(--status-first-draft)',
  REVISED: 'var(--status-revised)',
  FINAL: 'var(--status-final)',
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  node: TreeNode
  depth: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BinderItem({ node, depth }: Props) {
  const { activeItemId, setActiveItemId, updateBinderItem, pendingRenameId, setPendingRenameId } = useBookEditor()
  const { collapsed, toggleCollapsed, dropZone } = useBinderTree()
  const dropZoneForThisRow = dropZone?.overId === node.id ? dropZone.zone : null

  const [isRenaming, setIsRenaming] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isActive = activeItemId === node.id
  const isCollapsible = COLLAPSIBLE_TYPES.has(node.type)
  const isCollapsed = collapsed.has(node.id)
  const Icon = ICONS[node.type]
  const iconTint = ICON_TINTS[node.type]

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id })

  // Folder rows expose a SEPARATE droppable overlay covering only the middle
  // band (top:6 to bottom:6). It is NOT in SortableContext, so it doesn't
  // participate in verticalListSortingStrategy's reorder choreography — the
  // folder row stops shifting when the user hovers its middle, and the over
  // resolves to this overlay's id (`${node.id}:nest`). Top/bottom 6px fall
  // through to the sortable below for normal reorder-before / reorder-after.
  const isFolderType = node.type === 'part' || node.type === 'research_folder' || node.type === 'wiki_folder'
  const { setNodeRef: setNestRef } = useDroppable({
    id: `${node.id}:nest`,
    disabled: !isFolderType,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  useEffect(() => {
    if (isRenaming) {
      // Defer past Radix's focus-restoration after dropdown close
      const id = setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 0)
      return () => clearTimeout(id)
    }
  }, [isRenaming])

  useEffect(() => {
    if (pendingRenameId === node.id) {
      setIsRenaming(true)
      setPendingRenameId(null)
    }
  }, [pendingRenameId, node.id, setPendingRenameId])

  const commitRename = useCallback(async () => {
    const newTitle = inputRef.current?.value.trim() || node.title
    setIsRenaming(false)
    updateBinderItem(node.id, { title: newTitle })
    await updateBinderItemAction(node.id, { title: newTitle })
  }, [node.id, node.title, updateBinderItem])

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitRename()
    } else if (e.key === 'Escape') {
      setIsRenaming(false)
    }
  }, [commitRename])

  const handleRenameBlur = useCallback(() => {
    commitRename()
  }, [commitRename])

  // Whole row is the drag handle. Skip listeners while renaming so text
  // selection inside the input doesn't trigger a sortable drag (the input's
  // pointer moves would otherwise hit the 8px activation threshold).
  const dragListeners = isRenaming ? {} : listeners
  const dragAttributes = isRenaming ? {} : attributes

  // dnd-kit's `setNodeRef` MUST sit on just the row — not on a wrapper that
  // also contains rendered children. closestCenter collision detection uses
  // the ref'd element's geometric center; if children render inside the
  // ref'd wrapper, an expanded folder's center sinks into its subtree and
  // child rows steal the `over` event, making it impossible to drop onto
  // the folder itself. Layout wrapper (for children) stays outside ref scope.
  return (
    <div>
      {dropZoneForThisRow === 'before' && (
        <div className="h-0.5 bg-brand rounded-full mx-2" aria-hidden />
      )}
      <div
        ref={setNodeRef}
        style={{
          ...style,
          paddingLeft: `${8 + depth * 12}px`,
          borderRadius: 'var(--r-row)',
          background: isActive
            ? 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))'
            : undefined,
          // Compose --sh-tile depth with the 2px brand-yellow inset left marker.
          // Drag-middle ring overrides everything below.
          boxShadow:
            dropZoneForThisRow === 'middle'
              ? '0 0 0 4px oklch(from var(--brand) l c h / 0.25)'
              : isActive
                ? 'var(--sh-tile), inset 2px 0 0 var(--brand)'
                : undefined,
        }}
        {...dragAttributes}
        {...dragListeners}
        className={cn(
          'group flex items-center gap-2 h-8 pr-2 select-none transition-colors relative',
          'text-foreground',
          !isActive && 'hover:bg-[linear-gradient(180deg,var(--canvas-dark-250),var(--canvas-dark-200))]',
          isRenaming ? 'cursor-text' : 'cursor-grab',
          isRenaming && !isActive && 'bg-[linear-gradient(180deg,var(--canvas-dark-250),var(--canvas-dark-200))]',
          dropZoneForThisRow === 'middle' && 'ring-2 ring-brand bg-brand/20',
        )}
        onClick={() => setActiveItemId(node.id)}
        aria-label={isRenaming ? undefined : 'Drag to reorder'}
      >
        {/* Grip handle is absolutely positioned so it doesn't eat layout space
            when hidden — without this, every row gets a ~20px invisible gutter
            on the left (12px icon + 8px gap), making icon + title look
            center-shifted instead of flush against the indent edge. */}
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-muted-foreground pointer-events-none"
          aria-hidden
        >
          <GripVertical size={12} />
        </span>

        {isCollapsible ? (
          <button
            onClick={e => { e.stopPropagation(); toggleCollapsed(node.id) }}
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
            className="text-muted-foreground flex-shrink-0 inline-flex items-center justify-center w-3.5 h-3.5"
          >
            <ChevronRight
              size={12}
              style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.15s' }}
            />
          </button>
        ) : (
          <span className="w-3.5 flex-shrink-0" aria-hidden />
        )}

        {(() => {
          const deco = getNoteDecorations(node)
          if (deco.colorHex) {
            return (
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: deco.colorHex }}
                aria-label="Note color"
              />
            )
          }
          return (
            <span className="flex-shrink-0 inline-flex items-center justify-center" style={{ color: iconTint }}>
              <Icon size={14} />
            </span>
          )
        })()}

        {node.type === 'chapter' && node.chapterStatus && (
          <span
            className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: STATUS_COLOR[node.chapterStatus] }}
            aria-label={`Status: ${node.chapterStatus.toLowerCase().replace('_', ' ')}`}
          />
        )}

        {isRenaming ? (
          <input
            ref={inputRef}
            defaultValue={node.title}
            className="flex-1 min-w-0 bg-background border border-brand rounded-sm text-[13px] outline-none text-foreground px-2 py-0.5 shadow-[0_0_0_3px_var(--brand-soft)]"
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameBlur}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span
            className={cn(
              'flex-1 text-[13px] truncate',
              isActive ? 'font-medium text-foreground' : 'text-foreground',
            )}
            onDoubleClick={e => {
              e.stopPropagation()
              setIsRenaming(true)
            }}
          >
            {node.title}
          </span>
        )}

        {(() => {
          const deco = getNoteDecorations(node)
          return (
            <>
              {deco.pinned && (
                <Pin size={10} className="text-muted-foreground flex-shrink-0" aria-label="Pinned" />
              )}
              {deco.favorited && (
                <Star size={10} className="text-muted-foreground flex-shrink-0" aria-label="Favorite" />
              )}
            </>
          )
        })()}

        <BinderItemMenu node={node} onRenameStart={() => setIsRenaming(true)} />

        {/* Nest-target overlay — folder rows only. Covers ~87% of the row
            (top:3, bottom:3) so the user doesn't need to land precisely in
            the middle to nest. Reorder before/after still works in the
            narrow 3px edges. pointerWithin resolves `over` to this droppable
            (not the sortable) when the pointer is inside the overlay.
            pointer-events-none so it doesn't intercept clicks or drag. */}
        {isFolderType && (
          <div
            ref={setNestRef}
            className="absolute inset-x-0 pointer-events-none"
            style={{ top: 3, bottom: 3 }}
            aria-hidden
          />
        )}
      </div>
      {dropZoneForThisRow === 'after' && (
        <div className="h-0.5 bg-brand rounded-full mx-2" aria-hidden />
      )}

      {isCollapsible && !isCollapsed && node.children.map(child => (
        <BinderItem key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}
