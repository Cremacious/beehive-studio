'use client'

import { useState } from 'react'
import { useBookEditor } from '../book-editor-provider'
import { createBinderItemAction } from '@/lib/actions/binder.actions'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu'

function MenuItem({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <div
      role="menuitem"
      onClick={onClick}
      className="text-xs px-3 py-1.5 rounded cursor-pointer hover:bg-surface text-foreground/80 hover:text-foreground flex items-center gap-2"
    >
      {children}
    </div>
  )
}

export function BinderAddMenu() {
  const { bookId, binderItems, addBinderItem } = useBookEditor()
  const [open, setOpen] = useState(false)

  async function handleAdd(
    type: BinderItemRow['type'],
    title: string,
  ) {
    setOpen(false)
    const rootItems = binderItems.filter(i => i.parentId === null)
    const maxOrder = rootItems.length > 0
      ? Math.max(...rootItems.map(i => i.order))
      : -1
    const order = maxOrder + 1

    const result = await createBinderItemAction({
      bookId,
      parentId: null,
      type,
      title,
      order,
    })
    if (result.success) {
      addBinderItem({
        id: result.data.id,
        bookId,
        parentId: null,
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

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="text-brand hover:text-brand-hover text-lg font-light cursor-pointer leading-none">
          +
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 p-1">
        <MenuItem onClick={() => handleAdd('part', 'Untitled Part')}>
          Add Part
        </MenuItem>
        <MenuItem onClick={() => handleAdd('chapter', 'Untitled Chapter')}>
          Add Chapter
        </MenuItem>
        <MenuItem onClick={() => handleAdd('research_folder', 'Research')}>
          Add Research Folder
        </MenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
