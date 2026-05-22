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

type AddOption = {
  type: BinderItemRow['type']
  label: string
  defaultTitle: string
  subtitle: string
  icon: string
}

const MANUSCRIPT_OPTIONS: AddOption[] = [
  { type: 'chapter',      label: 'Chapter',        defaultTitle: 'Untitled Chapter',    subtitle: 'The actual prose. Opens in the editor.',     icon: '📄' },
  { type: 'part',         label: 'Collection',     defaultTitle: 'Untitled Collection', subtitle: 'A group of chapters (e.g., "Part One").',    icon: '📖' },
  { type: 'front_matter', label: 'Front matter',   defaultTitle: 'Front matter',        subtitle: 'Title page, dedication, copyright.',         icon: '📑' },
  { type: 'back_matter',  label: 'Back matter',    defaultTitle: 'Back matter',         subtitle: 'Acknowledgments, about the author.',         icon: '📑' },
]

const RESEARCH_OPTIONS: AddOption[] = [
  { type: 'research_folder', label: 'Research folder', defaultTitle: 'Research',           subtitle: 'Container for your reference materials.',     icon: '📁' },
  { type: 'research_note',   label: 'Research note',   defaultTitle: 'Untitled note',      subtitle: 'Freeform notes — world-building, ideas.',     icon: '📝' },
  { type: 'character',       label: 'Character',       defaultTitle: 'Untitled Character', subtitle: 'Name, traits, backstory for one character.',  icon: '👤' },
  { type: 'outline',         label: 'Outline',         defaultTitle: 'Untitled Outline',   subtitle: 'Outline of a chapter or arc.',                icon: '📋' },
]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  )
}

function MenuItem({
  option,
  onClick,
}: {
  option: AddOption
  onClick: () => void
}) {
  return (
    <div
      role="menuitem"
      onClick={onClick}
      className="px-3 py-2 rounded cursor-pointer hover:bg-surface text-foreground/80 hover:text-foreground flex items-start gap-2"
    >
      <span className="text-sm mt-0.5">{option.icon}</span>
      <div className="flex flex-col">
        <span className="text-xs font-medium leading-tight">{option.label}</span>
        <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">{option.subtitle}</span>
      </div>
    </div>
  )
}

export function BinderAddMenu() {
  const { bookId, binderItems, addBinderItem, setActiveItemId, setPendingRenameId } = useBookEditor()
  const [open, setOpen] = useState(false)

  async function handleAdd(option: AddOption) {
    setOpen(false)
    const rootItems = binderItems.filter(i => i.parentId === null)
    const maxOrder = rootItems.length > 0 ? Math.max(...rootItems.map(i => i.order)) : -1
    const order = maxOrder + 1

    const initialContent =
      option.type === 'front_matter' || option.type === 'back_matter'
        ? { subtype: null, fields: {} }
        : null

    const result = await createBinderItemAction({
      bookId,
      parentId: null,
      type: option.type,
      title: option.defaultTitle,
      order,
      content: initialContent,
    })
    if (result.success) {
      addBinderItem({
        id: result.data.id,
        bookId,
        parentId: null,
        type: option.type,
        title: option.defaultTitle,
        order,
        content: initialContent,
        chapterId: result.data.chapterId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      // Open the new item in the editor and immediately enter rename mode so
      // the user can name it before doing anything else. Reuses the
      // pendingRenameId mechanism added in SP2 Task 5.
      setActiveItemId(result.data.id)
      setPendingRenameId(result.data.id)
    } else {
      console.error('createBinderItemAction failed:', result.error)
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1 rounded-md bg-brand hover:bg-brand-hover px-2.5 py-1 text-xs font-semibold text-background transition-colors shadow-sm"
          title="Add chapter, collection, character, and more"
        >
          <span className="text-sm leading-none">+</span>
          <span>Add</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-1">
        <SectionLabel>Manuscript</SectionLabel>
        {MANUSCRIPT_OPTIONS.map(opt => (
          <MenuItem key={opt.type} option={opt} onClick={() => handleAdd(opt)} />
        ))}
        <SectionLabel>
          Research <span className="font-normal normal-case text-muted-foreground/70">(only you can see these)</span>
        </SectionLabel>
        {RESEARCH_OPTIONS.map(opt => (
          <MenuItem key={opt.type} option={opt} onClick={() => handleAdd(opt)} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
