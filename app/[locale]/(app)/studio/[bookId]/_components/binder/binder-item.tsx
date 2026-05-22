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

// ─── Icon mapping ─────────────────────────────────────────────────────────────

const ICONS: Record<BinderItemRow['type'], string> = {
  part: '',
  chapter: '📄',
  front_matter: '📄',
  back_matter: '📄',
  research_folder: '📁',
  research_note: '📝',
  character: '👤',
  outline: '📋',
}

const COLLAPSIBLE_TYPES = new Set<BinderItemRow['type']>(['part', 'research_folder'])

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  node: TreeNode
  depth: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BinderItem({ node, depth }: Props) {
  const { activeItemId, setActiveItemId, updateBinderItem } = useBookEditor()
  const { collapsed, toggleCollapsed } = useBinderTree()

  const [isRenaming, setIsRenaming] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isActive = activeItemId === node.id
  const isCollapsible = COLLAPSIBLE_TYPES.has(node.type)
  const isCollapsed = collapsed.has(node.id)
  const icon = ICONS[node.type]

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

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          'group flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer select-none',
          'hover:bg-surface-elevated transition-colors',
          isActive && 'bg-brand/10 border border-brand/20',
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={() => setActiveItemId(node.id)}
      >
        <span
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 cursor-grab text-muted-foreground text-xs mr-0.5"
        >
          ⠿
        </span>

        {isCollapsible && (
          <button
            onClick={e => { e.stopPropagation(); toggleCollapsed(node.id) }}
            className="text-muted-foreground text-xs w-3"
          >
            {isCollapsed ? '▸' : '▾'}
          </button>
        )}

        <span className="text-xs">{icon}</span>

        {isRenaming ? (
          <input
            ref={inputRef}
            defaultValue={node.title}
            className="flex-1 bg-transparent border-b border-brand text-xs outline-none text-foreground"
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameBlur}
          />
        ) : (
          <span
            className={cn('flex-1 text-xs truncate', isActive ? 'text-brand' : 'text-foreground/70')}
            onDoubleClick={e => {
              e.stopPropagation()
              setIsRenaming(true)
            }}
          >
            {node.title}
          </span>
        )}

        <BinderItemMenu node={node} onRenameStart={() => setIsRenaming(true)} />
      </div>

      {isCollapsible && !isCollapsed && node.children.map(child => (
        <BinderItem key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}
