'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useBookEditor } from '../book-editor-provider'
import { useBinderTree, renderTree, type TreeNode } from './binder-tree'
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
  ChevronUp,
  ChevronDown,
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
  const { collapsed, toggleCollapsed, canMoveUp, canMoveDown, moveItem } = useBinderTree()

  const [isRenaming, setIsRenaming] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isActive = activeItemId === node.id
  const isCollapsible = COLLAPSIBLE_TYPES.has(node.type)
  const isCollapsed = collapsed.has(node.id)
  const Icon = ICONS[node.type]
  const iconTint = ICON_TINTS[node.type]

  const canUp = canMoveUp(node.id)
  const canDown = canMoveDown(node.id)

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

  // Arrow stack reserves the same fixed 28px slot the old grip handle did,
  // so titles don't shift left/right when hover reveals or hides the arrows.
  // Always visible on the active row (keyboard-only path works without mousemove).
  const showArrows = isActive

  return (
    <div>
      <div
        style={{
          paddingLeft: `${depth * 12}px`,
          borderRadius: 'var(--r-row)',
          background: isActive
            ? 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))'
            : undefined,
          boxShadow: isActive ? 'var(--sh-tile)' : undefined,
        }}
        className={cn(
          'group flex items-center gap-2 h-9 pr-2 select-none transition-colors relative',
          'text-foreground',
          !isActive && 'hover:bg-[linear-gradient(180deg,var(--canvas-dark-250),var(--canvas-dark-200))]',
          isRenaming ? 'cursor-text' : 'cursor-pointer',
          isRenaming && !isActive && 'bg-[linear-gradient(180deg,var(--canvas-dark-250),var(--canvas-dark-200))]',
        )}
        onClick={() => setActiveItemId(node.id)}
      >
        {/* Reorder arrows. Fixed 28px slot keeps the title column stable
            whether arrows are visible or not. Visible on hover (group-hover)
            and always visible on the active row. */}
        <span
          className={cn(
            'flex-shrink-0 flex flex-col items-center justify-center transition-opacity',
            showArrows
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100',
          )}
          style={{ width: 24, height: 32 }}
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={e => { e.stopPropagation(); if (canUp) moveItem(node.id, 'up') }}
            disabled={!canUp}
            aria-label="Move up"
            title={canUp ? 'Move up' : 'Already at top'}
            className={cn(
              'w-6 h-[15px] flex items-center justify-center rounded-t-[6px] border border-b-0 transition-colors',
              canUp
                ? 'border-white/10 bg-[linear-gradient(180deg,var(--canvas-dark-400),var(--canvas-dark-350))] text-foreground hover:bg-[linear-gradient(180deg,var(--brand),oklch(0.78_0.16_86))] hover:text-[var(--brand-ink)] cursor-pointer'
                : 'border-white/5 bg-[linear-gradient(180deg,var(--canvas-dark-300),var(--canvas-dark-250))] text-muted-foreground/40 cursor-not-allowed',
            )}
          >
            <ChevronUp size={11} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); if (canDown) moveItem(node.id, 'down') }}
            disabled={!canDown}
            aria-label="Move down"
            title={canDown ? 'Move down' : 'Already at bottom'}
            className={cn(
              'w-6 h-[15px] flex items-center justify-center rounded-b-[6px] border transition-colors',
              canDown
                ? 'border-white/10 bg-[linear-gradient(180deg,var(--canvas-dark-400),var(--canvas-dark-350))] text-foreground hover:bg-[linear-gradient(180deg,var(--brand),oklch(0.78_0.16_86))] hover:text-[var(--brand-ink)] cursor-pointer'
                : 'border-white/5 bg-[linear-gradient(180deg,var(--canvas-dark-300),var(--canvas-dark-250))] text-muted-foreground/40 cursor-not-allowed',
            )}
          >
            <ChevronDown size={11} strokeWidth={2.5} />
          </button>
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

      </div>

      {isCollapsible && !isCollapsed && (
        <>
          {renderTree(node.children, depth + 1)}
        </>
      )}
    </div>
  )
}
