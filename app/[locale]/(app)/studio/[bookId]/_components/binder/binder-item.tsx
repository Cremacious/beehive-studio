'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { useBookEditor } from '../book-editor-provider'
import { useBinderTree, type TreeNode } from './binder-tree'
import { BinderItemMenu } from './binder-item-menu'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
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
}

const COLLAPSIBLE_TYPES = new Set<BinderItemRow['type']>(['part', 'research_folder'])

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

  return (
    <div ref={setNodeRef} style={style}>
      {dropZoneForThisRow === 'before' && (
        <div className="h-0.5 bg-brand rounded-full mx-2" aria-hidden />
      )}
      <div
        {...dragAttributes}
        {...dragListeners}
        className={cn(
          'group flex items-center gap-2 h-8 pr-2 rounded-md select-none transition-colors relative',
          'text-foreground hover:bg-surface-elevated',
          isRenaming ? 'cursor-text' : 'cursor-grab',
          isActive && 'bg-brand/15 text-foreground shadow-[inset_2px_0_0_var(--brand)]',
          isRenaming && 'bg-surface-elevated',
          dropZoneForThisRow === 'middle' && 'ring-2 ring-brand bg-brand/10',
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={() => setActiveItemId(node.id)}
        aria-label={isRenaming ? undefined : 'Drag to reorder'}
      >
        <span
          className="opacity-0 group-hover:opacity-100 text-muted-foreground flex-shrink-0"
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
