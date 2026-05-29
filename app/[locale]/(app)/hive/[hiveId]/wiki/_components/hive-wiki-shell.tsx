'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createBinderItemAction } from '@/lib/actions/binder.actions'
import type { HiveWikiViewData, HiveWikiEntry } from '@/lib/actions/hive-content.actions'
import { canEditWiki } from '@/lib/hive/permissions'
import { CATEGORY_TEMPLATE_MAP, type WikiCategory } from '@/lib/wiki/category-templates'
import { WikiCategoryPicker } from '@/app/[locale]/(app)/studio/[bookId]/_components/binder/wiki-category-picker'
import { ByCategoryView } from './by-category-view'
import { ByFolderView } from './by-folder-view'
import { NotesView } from './notes-view'
import { HiveWikiEntryEditor } from './hive-wiki-entry-editor'
import type { BinderItemRow } from '@/lib/actions/binder.actions'

type NotesData = {
  bookId: string
  notes: Array<BinderItemRow & { authorUsername: string | null }>
}

type ViewMode = 'category' | 'folder' | 'notes'

function matchesSearch(e: HiveWikiEntry, search: string): boolean {
  if (!search) return true
  const s = search.toLowerCase()
  if (e.title.toLowerCase().includes(s)) return true
  if (e.excerpt.toLowerCase().includes(s)) return true
  if (e.tags.some(t => t.toLowerCase().includes(s))) return true
  return false
}

export function HiveWikiShell({
  wiki,
  notes,
  hiveId,
  locale: _locale,
}: {
  wiki: HiveWikiViewData
  notes: NotesData
  hiveId: string
  locale: string
}) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>('category')
  const [search, setSearch] = useState('')
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const canEdit = canEditWiki(wiki.viewerRole)

  const filteredEntries = useMemo(
    () => wiki.entries.filter(e => matchesSearch(e, search)),
    [wiki.entries, search],
  )

  const selectedEntry = selectedEntryId
    ? wiki.entries.find(e => e.id === selectedEntryId) ?? null
    : null

  function handlePickCategory(category: WikiCategory) {
    setPickerOpen(false)
    const template = CATEGORY_TEMPLATE_MAP[category]
    const rootItems = [
      ...wiki.entries.filter(e => e.parentId === null),
      ...wiki.folders.filter(f => f.parentId === null),
    ]
    const maxOrder = rootItems.length
    startTransition(async () => {
      const r = await createBinderItemAction({
        bookId: wiki.bookId,
        parentId: null,
        type: 'wiki_entry',
        title: `New ${template.label}`,
        order: maxOrder + 1,
        content: { category, body: template.defaultBody, tags: [] } as unknown as Record<string, unknown>,
      })
      if (!r.success) {
        toast.error(r.error)
        return
      }
      setSelectedEntryId(r.data.id)
      router.refresh()
    })
  }

  if (selectedEntry) {
    return (
      <HiveWikiEntryEditor
        entryId={selectedEntry.id}
        bookId={wiki.bookId}
        hiveId={hiveId}
        viewerRole={wiki.viewerRole}
        authorUsername={selectedEntry.authorUsername}
        lastEditedAt={selectedEntry.lastEditedAt}
        onBack={() => setSelectedEntryId(null)}
      />
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-6">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-comfortaa font-bold text-2xl">Wiki</h1>
          {canEdit && viewMode !== 'notes' && (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              disabled={pending}
              className="inline-flex items-center gap-1.5 text-xs rounded-md px-3 py-1.5 bg-brand text-brand-ink font-semibold hover:opacity-90 disabled:opacity-50"
            >
              <Plus size={12} /> New Entry
            </button>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search title, tags, excerpt…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-border bg-card outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div className="inline-flex rounded-md border border-border bg-card p-1 text-xs">
            {(['category', 'folder', 'notes'] as ViewMode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setViewMode(m)}
                className={cn(
                  'px-3 py-1.5 rounded font-medium',
                  viewMode === m
                    ? 'bg-brand text-brand-ink'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m === 'category' ? 'By Category' : m === 'folder' ? 'By Folder' : 'Notes'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {viewMode === 'category' && (
        <ByCategoryView
          entries={filteredEntries}
          canEdit={canEdit}
          onOpenEntry={setSelectedEntryId}
          onAddEntry={() => setPickerOpen(true)}
        />
      )}
      {viewMode === 'folder' && (
        <ByFolderView
          entries={filteredEntries}
          folders={wiki.folders}
          onOpenEntry={setSelectedEntryId}
        />
      )}
      {viewMode === 'notes' && (
        <NotesView
          notes={notes.notes}
          bookId={wiki.bookId}
          canEdit={canEdit}
        />
      )}

      <WikiCategoryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={handlePickCategory}
      />
    </div>
  )
}
