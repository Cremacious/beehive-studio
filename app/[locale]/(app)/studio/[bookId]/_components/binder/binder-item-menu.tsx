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
      className={cn(
        'text-xs px-3 py-1.5 rounded cursor-pointer hover:bg-surface flex items-center gap-2',
        destructive
          ? 'text-destructive hover:text-destructive'
          : 'text-foreground/80 hover:text-foreground',
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
      setConfirmingDelete(false)
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
        chapterId: result.data.chapterId,
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
      setOpen(false)
    } else {
      console.error('deleteBinderItemAction failed:', result.error)
      setConfirmingDelete(false)
    }
  }

  const menuItems = (() => {
    switch (node.type) {
      case 'part':
        return (
          <>
            <MenuItem onClick={() => handleAddChild('chapter', 'Untitled Chapter')}>
              Add Chapter
            </MenuItem>
            <MenuItem onClick={handleRenameStart}>
              Rename
            </MenuItem>
            <DropdownMenuSeparator />
          </>
        )
      case 'research_folder':
        return (
          <>
            <MenuItem onClick={() => handleAddChild('research_note', 'Untitled Note')}>
              Add Note
            </MenuItem>
            <MenuItem onClick={() => handleAddChild('character', 'Untitled Character')}>
              Add Character
            </MenuItem>
            <MenuItem onClick={() => handleAddChild('outline', 'Untitled Outline')}>
              Add Outline
            </MenuItem>
            <MenuItem onClick={handleRenameStart}>
              Rename
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
                ← Back
              </MenuItem>
              <DropdownMenuSeparator />
              {currentParent !== null && (
                <MenuItem onClick={() => handleMove(null)}>
                  ↑ Move to top level
                </MenuItem>
              )}
              {collections.map(c => (
                c.id !== currentParent ? (
                  <MenuItem key={c.id} onClick={() => handleMove(c.id)}>
                    📖 {c.title}
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
              Rename
            </MenuItem>
            {canMove && (
              <MenuItem onClick={() => setShowMoveTo(true)}>
                Move to Collection…
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
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground text-xs ml-auto px-0.5 rounded"
        >
          ⋯
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-44 p-1"
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

        {confirmingDelete ? (
          <div className="text-xs px-2 py-1">
            <div className="text-foreground/80 mb-1.5">Delete "{node.title}"?</div>
            <div className="flex gap-2">
              <button
                onClick={handleDeleteConfirm}
                className="text-destructive hover:text-destructive font-medium"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="text-foreground/60 hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <MenuItem destructive onClick={() => setConfirmingDelete(true)}>
            Delete
          </MenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
