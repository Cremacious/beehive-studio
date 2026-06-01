'use client'

import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useBookEditor } from '../book-editor-provider'
import { createBinderItemAction, deleteBinderItemAction, updateBinderItemAction } from '@/lib/actions/binder.actions'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import type { TreeNode } from './binder-tree'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { MoreHorizontal, Pencil, Plus, FolderInput, Trash2, ChevronLeft, ArrowUp, BookOpen } from 'lucide-react'

type Props = { node: TreeNode; onRenameStart: () => void }

function MenuItem({
  onClick,
  destructive,
  children,
}: {
  onClick: () => void
  destructive?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      role="menuitem"
      onClick={onClick}
      style={{ borderRadius: 'var(--r-row)' }}
      className={cn(
        'text-[13px] px-2.5 py-2 cursor-pointer flex items-center gap-2.5 transition-colors',
        destructive
          ? 'text-destructive hover:bg-destructive/10 [&_svg]:text-destructive'
          : 'text-foreground hover:bg-[linear-gradient(180deg,var(--canvas-dark-250),var(--canvas-dark-200))] [&_svg]:text-muted-foreground hover:[&_svg]:text-foreground',
      )}
    >
      {children}
    </div>
  )
}

export function BinderItemMenu({ node, onRenameStart }: Props) {
  const { bookId, binderItems, addBinderItem, removeBinderItem, updateBinderItem } = useBookEditor()
  const [open, setOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [showMoveTo, setShowMoveTo] = useState(false)
  // Tracks whether the close was triggered by clicking Rename — used to
  // suppress Radix's auto-restore-focus-to-trigger, which otherwise steals
  // focus away from the rename input the moment it tries to mount.
  const renameClicked = useRef(false)

  function handleRenameStart() {
    renameClicked.current = true
    setOpen(false)
    onRenameStart()
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setShowMoveTo(false)
    }
  }

  async function handleMove(newParentId: string | null) {
    setOpen(false)
    setShowMoveTo(false)
    updateBinderItem(node.id, { parentId: newParentId })
    const result = await updateBinderItemAction(node.id, { parentId: newParentId })
    if (!result.success) {
      console.error('Move failed:', result.error)
    }
  }

  async function handleAddChild(
    type: BinderItemRow['type'],
    title: string,
  ) {
    setOpen(false)
    const order = node.children.length
    const result = await createBinderItemAction({
      bookId,
      parentId: node.id,
      type,
      title,
      order,
    })
    if (result.success) {
      addBinderItem({
        id: result.data.id,
        bookId,
        parentId: node.id,
        type,
        title,
        order,
        content: null,
        authorId: null,
        lastEditedBy: null,
        chapterId: result.data.chapterId,
        chapterStatus: result.data.chapterId ? 'FIRST_DRAFT' : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    } else {
      console.error('createBinderItemAction failed:', result.error)
    }
  }

  async function handleDeleteConfirm() {
    const result = await deleteBinderItemAction(node.id)
    if (result.success) {
      removeBinderItem(node.id)
    } else {
      console.error('deleteBinderItemAction failed:', result.error)
    }
  }

  function openDeleteConfirm() {
    setOpen(false)
    setConfirmingDelete(true)
  }

  const menuItems = (() => {
    switch (node.type) {
      case 'part':
        return (
          <>
            <MenuItem onClick={() => handleAddChild('chapter', 'Untitled Chapter')}>
              <Plus size={14} /> Add Chapter
            </MenuItem>
            <MenuItem onClick={handleRenameStart}>
              <Pencil size={14} /> Rename
            </MenuItem>
            <DropdownMenuSeparator />
          </>
        )
      case 'research_folder':
        return (
          <>
            <MenuItem onClick={() => handleAddChild('research_note', 'Untitled Note')}>
              <Plus size={14} /> Add Note
            </MenuItem>
            <MenuItem onClick={() => handleAddChild('character', 'Untitled Character')}>
              <Plus size={14} /> Add Character
            </MenuItem>
            <MenuItem onClick={() => handleAddChild('outline', 'Untitled Outline')}>
              <Plus size={14} /> Add Outline
            </MenuItem>
            <MenuItem onClick={handleRenameStart}>
              <Pencil size={14} /> Rename
            </MenuItem>
            <DropdownMenuSeparator />
          </>
        )
      default: {
        const collections = binderItems.filter(i => i.type === 'part')
        const canMove = node.type === 'chapter' && collections.length > 0
        const currentParent = node.parentId

        if (showMoveTo) {
          return (
            <>
              <MenuItem onClick={() => setShowMoveTo(false)}>
                <ChevronLeft size={14} /> Back
              </MenuItem>
              <DropdownMenuSeparator />
              {currentParent !== null && (
                <MenuItem onClick={() => handleMove(null)}>
                  <ArrowUp size={14} /> Move to top level
                </MenuItem>
              )}
              {collections.map(c => (
                c.id !== currentParent ? (
                  <MenuItem key={c.id} onClick={() => handleMove(c.id)}>
                    <BookOpen size={14} /> {c.title}
                  </MenuItem>
                ) : null
              ))}
              <DropdownMenuSeparator />
            </>
          )
        }

        return (
          <>
            <MenuItem onClick={handleRenameStart}>
              <Pencil size={14} /> Rename
            </MenuItem>
            {canMove && (
              <MenuItem onClick={() => setShowMoveTo(true)}>
                <FolderInput size={14} /> Move to Collection…
              </MenuItem>
            )}
            <DropdownMenuSeparator />
          </>
        )
      }
    }
  })()

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          onClick={e => e.stopPropagation()}
          aria-label="Item options"
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-surface inline-flex items-center justify-center w-5 h-5 rounded transition-colors"
        >
          <MoreHorizontal size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
        }}
        className="w-52 p-1.5"
        onClick={e => e.stopPropagation()}
        onCloseAutoFocus={e => {
          // Only suppress focus-restoration when closing because Rename was
          // clicked — otherwise (Escape, outside-click) focus correctly
          // returns to the trigger for keyboard nav.
          if (renameClicked.current) {
            e.preventDefault()
            renameClicked.current = false
          }
        }}
      >
        {menuItems}

        <MenuItem destructive onClick={openDeleteConfirm}>
          <Trash2 size={14} /> Delete
        </MenuItem>
      </DropdownMenuContent>
      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        variant="destructive"
        title="Delete item?"
        description={`This will permanently delete "${node.title}" and any nested items. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
      />
    </DropdownMenu>
  )
}
