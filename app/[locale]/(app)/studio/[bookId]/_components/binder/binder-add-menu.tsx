'use client'

import { useState } from 'react'
import { useBookEditor } from '../book-editor-provider'
import { createBinderItemAction } from '@/lib/actions/binder.actions'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import { CATEGORY_TEMPLATE_MAP } from '@/lib/wiki/category-templates'
import type { WikiCategory } from '@/lib/wiki/category-templates'
import { createId } from '@paralleldrive/cuid2'
import { WikiCategoryPicker } from './wiki-category-picker'
import { FrontBackMatterPicker } from './front-back-matter-picker'
import { ChapterSourcePicker } from './chapter-source-picker'
import { ImportModal } from '../import/import-modal'
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
  special?: 'wiki-picker' | 'fm-bm-picker' | 'chapter-source'
}

const MANUSCRIPT_OPTIONS: AddOption[] = [
  { type: 'chapter',      label: 'Chapter',                  defaultTitle: 'Untitled Chapter', subtitle: 'Blank page, or import from a file.',         Icon: FileText,   tint: 'var(--type-chapter)', special: 'chapter-source' },
  { type: 'part',         label: 'Part (collection)',        defaultTitle: 'Untitled Part',    subtitle: 'A group of chapters (e.g., "Part One").',    Icon: BookOpen,   tint: 'var(--type-chapter)' },
  { type: 'front_matter', label: 'Front/Back matter ▸',      defaultTitle: '',                 subtitle: 'Title pages, dedication, acknowledgments…',  Icon: ScrollText, tint: 'var(--type-front-matter)', special: 'fm-bm-picker' },
]

const WORLDBUILDING_OPTIONS: AddOption[] = [
  { type: 'wiki_entry',  label: 'Wiki Entry ▸',  defaultTitle: '',                   subtitle: '14 categories. Pick one to start.',          Icon: NotebookPen, tint: 'var(--wiki-other)', special: 'wiki-picker' },
  { type: 'wiki_folder', label: 'Wiki Folder',   defaultTitle: 'Untitled Folder',    subtitle: 'A container for wiki entries.',               Icon: FolderTree,  tint: 'var(--wiki-other)' },
]

const PLANNING_OPTIONS: AddOption[] = [
  { type: 'outline',         label: 'Outline',         defaultTitle: 'Untitled Outline', subtitle: 'Beat sheet with optional acts.', Icon: LayoutIcon, tint: 'var(--type-outline)' },
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
  const { bookId, binderItems, addBinderItem, setActiveItemId, setPendingRenameId, isPremium } = useBookEditor()
  const [open, setOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [fmBmPickerOpen, setFmBmPickerOpen] = useState(false)
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  // Create a root-level binder item (blank). Shared by the menu options and the
  // "Blank chapter" choice in the chapter-source picker.
  async function createRootItem(
    type: BinderItemRow['type'],
    title: string,
    content: Record<string, unknown> | null,
  ) {
    const rootItems = binderItems.filter(i => i.parentId === null)
    const maxOrder = rootItems.length > 0 ? Math.max(...rootItems.map(i => i.order)) : -1
    const order = maxOrder + 1

    const result = await createBinderItemAction({ bookId, parentId: null, type, title, order, content })
    if (result.success) {
      addBinderItem({
        id: result.data.id,
        bookId,
        parentId: null,
        type,
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

  async function handleAdd(option: AddOption) {
    setOpen(false)
    if (option.special === 'wiki-picker') {
      setPickerOpen(true)
      return
    }
    if (option.special === 'fm-bm-picker') {
      setFmBmPickerOpen(true)
      return
    }
    if (option.special === 'chapter-source') {
      setChapterPickerOpen(true)
      return
    }
    const initialContent =
      option.type === 'front_matter' || option.type === 'back_matter'
        ? { subtype: null, fields: {} }
        : null
    await createRootItem(option.type, option.defaultTitle, initialContent)
  }

  function handleChapterSource(source: 'blank' | 'import') {
    setChapterPickerOpen(false)
    if (source === 'blank') {
      void createRootItem('chapter', 'Untitled Chapter', null)
    } else {
      setImportOpen(true)
    }
  }

  async function handlePickCategory(category: WikiCategory) {
    setPickerOpen(false)
    const template = CATEGORY_TEMPLATE_MAP[category]
    const rootItems = binderItems.filter(i => i.parentId === null)
    const maxOrder = rootItems.length > 0 ? Math.max(...rootItems.map(i => i.order)) : -1
    const order = maxOrder + 1
    // CHARACTER stays a first-class `character` binder type so the dedicated
    // profile renderer (sheet-style with avatar + 6 sections) handles it.
    // The hive's getHiveWikiView union-coerces `character` rows back to
    // CHARACTER-category wiki entries, so this stays consistent across both
    // surfaces — wiki picker shows 14, but on-disk shape preserves the
    // character renderer's data contract.
    const isCharacter = category === 'CHARACTER'
    const type = isCharacter ? 'character' : 'wiki_entry'
    const title = isCharacter ? 'Untitled Character' : `New ${template.label}`
    // Start blank — one empty section labeled "Notes". Users add their own
    // sections via the + Add section button (and rename "Notes" if they like).
    // Skip the template seed so the entry feels intentional, not pre-filled.
    const seededSections = isCharacter ? [] : [{ id: `s_${createId()}`, label: 'Notes', body: { type: 'doc', content: [{ type: 'paragraph' }] } }]
    const content = isCharacter
      ? null
      : {
          category,
          sections: seededSections,
          tags: [],
          hints: {},
        }

    const result = await createBinderItemAction({
      bookId,
      parentId: null,
      type,
      title,
      order,
      content,
    })
    if (result.success) {
      addBinderItem({
        id: result.data.id,
        bookId,
        parentId: null,
        type,
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

  async function handlePickFmBm(kind: 'front_matter' | 'back_matter') {
    setFmBmPickerOpen(false)
    const rootItems = binderItems.filter(i => i.parentId === null)
    const maxOrder = rootItems.length > 0 ? Math.max(...rootItems.map(i => i.order)) : -1
    const order = maxOrder + 1
    const title = kind === 'front_matter' ? 'Front matter' : 'Back matter'
    const initialContent = { subtype: null, fields: {} }

    const result = await createBinderItemAction({
      bookId,
      parentId: null,
      type: kind,
      title,
      order,
      content: initialContent,
    })
    if (result.success) {
      addBinderItem({
        id: result.data.id,
        bookId,
        parentId: null,
        type: kind,
        title,
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
      <FrontBackMatterPicker open={fmBmPickerOpen} onOpenChange={setFmBmPickerOpen} onPick={handlePickFmBm} />
      <ChapterSourcePicker
        open={chapterPickerOpen}
        onOpenChange={setChapterPickerOpen}
        onPick={handleChapterSource}
        isPremium={isPremium}
      />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  )
}
