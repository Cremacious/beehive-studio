'use client'

import { useState } from 'react'
import { useBookEditor } from '../book-editor-provider'
import { createBinderItemAction } from '@/lib/actions/binder.actions'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import { CATEGORY_TEMPLATE_MAP } from '@/lib/wiki/category-templates'
import type { WikiCategory } from '@/lib/wiki/category-templates'
import { WikiCategoryPicker } from './wiki-category-picker'
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
  NotebookPen,
  FolderTree,
  type LucideIcon,
} from 'lucide-react'

type AddOption = {
  type: BinderItemRow['type']
  label: string
  defaultTitle: string
  subtitle: string
  Icon: LucideIcon
  tint: string
  special?: 'wiki-picker'
}

const MANUSCRIPT_OPTIONS: AddOption[] = [
  { type: 'chapter',      label: 'Chapter',           defaultTitle: 'Untitled Chapter',    subtitle: 'The actual prose. Opens in the editor.',     Icon: FileText,   tint: 'var(--type-chapter)' },
  { type: 'part',         label: 'Part (collection)', defaultTitle: 'Untitled Part',       subtitle: 'A group of chapters (e.g., "Part One").',    Icon: BookOpen,   tint: 'var(--type-chapter)' },
  { type: 'front_matter', label: 'Front matter',      defaultTitle: 'Front matter',        subtitle: 'Title page, dedication, copyright.',         Icon: ScrollText, tint: 'var(--type-front-matter)' },
  { type: 'back_matter',  label: 'Back matter',       defaultTitle: 'Back matter',         subtitle: 'Acknowledgments, about the author.',         Icon: ScrollText, tint: 'var(--type-back-matter)' },
]

const WORLDBUILDING_OPTIONS: AddOption[] = [
  { type: 'character',   label: 'Character',     defaultTitle: 'Untitled Character', subtitle: 'Name, traits, backstory for one character.', Icon: UserIcon,    tint: 'var(--type-character)' },
  { type: 'wiki_entry',  label: 'Wiki Entry ▸',  defaultTitle: '',                   subtitle: '13 categories — pick one to start.',          Icon: NotebookPen, tint: 'var(--wiki-other)', special: 'wiki-picker' },
  { type: 'wiki_folder', label: 'Wiki Folder',   defaultTitle: 'Untitled Folder',    subtitle: 'A container for wiki entries.',               Icon: FolderTree,  tint: 'var(--wiki-other)' },
]

const PLANNING_OPTIONS: AddOption[] = [
  { type: 'outline',         label: 'Outline',         defaultTitle: 'Untitled Outline', subtitle: 'Beat sheet — optional acts.', Icon: LayoutIcon, tint: 'var(--type-outline)' },
  { type: 'research_note',   label: 'Research note',   defaultTitle: 'Untitled note',    subtitle: 'Freeform notes.',             Icon: StickyNote, tint: 'var(--type-research)' },
  { type: 'research_folder', label: 'Research folder', defaultTitle: 'Research',         subtitle: 'Container for notes.',        Icon: Folder,     tint: 'var(--type-research)' },
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
      style={{ borderRadius: 'var(--r-row)' }}
      className="px-2.5 py-2 cursor-pointer hover:bg-[linear-gradient(180deg,var(--canvas-dark-250),var(--canvas-dark-200))] text-foreground flex items-start gap-2.5 transition-colors"
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
  const [pickerOpen, setPickerOpen] = useState(false)

  async function handleAdd(option: AddOption) {
    setOpen(false)
    if (option.special === 'wiki-picker') {
      setPickerOpen(true)
      return
    }
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
        authorId: null,
        lastEditedBy: null,
        chapterId: result.data.chapterId,
        chapterStatus: result.data.chapterId ? 'FIRST_DRAFT' : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      setActiveItemId(result.data.id)
      setPendingRenameId(result.data.id)
    } else {
      console.error('createBinderItemAction failed:', result.error)
    }
  }

  async function handlePickCategory(category: WikiCategory) {
    setPickerOpen(false)
    const template = CATEGORY_TEMPLATE_MAP[category]
    const rootItems = binderItems.filter(i => i.parentId === null)
    const maxOrder = rootItems.length > 0 ? Math.max(...rootItems.map(i => i.order)) : -1
    const order = maxOrder + 1
    const title = `New ${template.label}`
    const content = { category, body: template.defaultBody, tags: [] }

    const result = await createBinderItemAction({
      bookId,
      parentId: null,
      type: 'wiki_entry',
      title,
      order,
      content,
    })
    if (result.success) {
      addBinderItem({
        id: result.data.id,
        bookId,
        parentId: null,
        type: 'wiki_entry',
        title,
        order,
        content,
        authorId: null,
        lastEditedBy: null,
        chapterId: result.data.chapterId,
        chapterStatus: result.data.chapterId ? 'FIRST_DRAFT' : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      setActiveItemId(result.data.id)
      setPendingRenameId(result.data.id)
    } else {
      console.error('createBinderItemAction failed:', result.error)
    }
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            data-binder-add-trigger
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-brand hover:bg-brand-hover px-3 py-2 text-[13px] font-bold font-comfortaa text-brand-ink transition-colors shadow-sm tracking-tight"
            title="Add chapter, collection, character, and more"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>Add</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="top"
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            borderRadius: 'var(--r-card)',
            boxShadow: 'var(--sh-card)',
            border: 'var(--br-card)',
          }}
          className="w-72 p-1.5"
        >
          <SectionLabel>Manuscript</SectionLabel>
          {MANUSCRIPT_OPTIONS.map(opt => (
            <MenuItem key={opt.type} option={opt} onClick={() => handleAdd(opt)} />
          ))}
          <SectionLabel>Worldbuilding</SectionLabel>
          {WORLDBUILDING_OPTIONS.map(opt => (
            <MenuItem key={opt.type} option={opt} onClick={() => handleAdd(opt)} />
          ))}
          <SectionLabel>Planning</SectionLabel>
          {PLANNING_OPTIONS.map(opt => (
            <MenuItem key={opt.type} option={opt} onClick={() => handleAdd(opt)} />
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <WikiCategoryPicker open={pickerOpen} onOpenChange={setPickerOpen} onPick={handlePickCategory} />
    </>
  )
}
