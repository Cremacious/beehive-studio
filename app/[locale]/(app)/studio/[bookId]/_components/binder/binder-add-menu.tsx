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
import {
  Plus,
  FileText,
  BookOpen,
  ScrollText,
  Folder,
  StickyNote,
  User as UserIcon,
  Layout as LayoutIcon,
  type LucideIcon,
} from 'lucide-react'

type AddOption = {
  type: BinderItemRow['type']
  label: string
  defaultTitle: string
  subtitle: string
  Icon: LucideIcon
  tint: string
}

const MANUSCRIPT_OPTIONS: AddOption[] = [
  { type: 'chapter',      label: 'Chapter',        defaultTitle: 'Untitled Chapter',    subtitle: 'The actual prose. Opens in the editor.',     Icon: FileText,   tint: 'var(--type-chapter)' },
  { type: 'part',         label: 'Collection',     defaultTitle: 'Untitled Collection', subtitle: 'A group of chapters (e.g., "Part One").',    Icon: BookOpen,   tint: 'var(--type-chapter)' },
  { type: 'front_matter', label: 'Front matter',   defaultTitle: 'Front matter',        subtitle: 'Title page, dedication, copyright.',         Icon: ScrollText, tint: 'var(--type-front-matter)' },
  { type: 'back_matter',  label: 'Back matter',    defaultTitle: 'Back matter',         subtitle: 'Acknowledgments, about the author.',         Icon: ScrollText, tint: 'var(--type-back-matter)' },
]

const RESEARCH_OPTIONS: AddOption[] = [
  { type: 'research_folder', label: 'Research folder', defaultTitle: 'Research',           subtitle: 'Container for your reference materials.',     Icon: Folder,      tint: 'var(--type-research)' },
  { type: 'research_note',   label: 'Research note',   defaultTitle: 'Untitled note',      subtitle: 'Freeform notes — world-building, ideas.',     Icon: StickyNote,  tint: 'var(--type-research)' },
  { type: 'character',       label: 'Character',       defaultTitle: 'Untitled Character', subtitle: 'Name, traits, backstory for one character.',  Icon: UserIcon,    tint: 'var(--type-character)' },
  { type: 'outline',         label: 'Outline',         defaultTitle: 'Untitled Outline',   subtitle: 'Outline of a chapter or arc.',                Icon: LayoutIcon,  tint: 'var(--type-outline)' },
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
      className="px-2.5 py-2 rounded-md cursor-pointer hover:bg-surface-elevated text-foreground flex items-start gap-2.5 transition-colors"
    >
      <span className="mt-0.5 flex-shrink-0 inline-flex items-center justify-center" style={{ color: option.tint }}>
        <option.Icon size={14} />
      </span>
      <div className="flex flex-col min-w-0">
        <span className="text-[13px] font-medium leading-tight">{option.label}</span>
        <span className="text-[11px] text-muted-foreground leading-tight mt-0.5">{option.subtitle}</span>
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
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-brand hover:bg-brand-hover px-3 py-2 text-[13px] font-bold font-comfortaa text-brand-ink transition-colors shadow-sm tracking-tight"
          title="Add chapter, collection, character, and more"
        >
          <Plus size={14} strokeWidth={2.5} />
          <span>Add</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-72 p-1.5 rounded-lg border border-border bg-popover shadow-lg">
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
