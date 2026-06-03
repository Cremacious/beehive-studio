'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createBinderItemAction } from '@/lib/actions/binder.actions'
import type { HiveWikiViewData, HiveWikiEntry } from '@/lib/actions/hive-content.actions'
import { canEditWiki } from '@/lib/hive/permissions'
import { CATEGORY_TEMPLATE_MAP, type WikiCategory } from '@/lib/wiki/category-templates'
import { createId } from '@paralleldrive/cuid2'
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
  const [, startTransition] = useTransition()

  const canEdit = canEditWiki(wiki.viewerRole)

  const filteredEntries = useMemo(
    () => wiki.entries.filter(e => matchesSearch(e, search)),
    [wiki.entries, search],
  )

  const selectedEntry = selectedEntryId
    ? wiki.entries.find(e => e.id === selectedEntryId) ?? null
    : null

  function handlePickCategory(category: WikiCategory) {
    const template = CATEGORY_TEMPLATE_MAP[category]
    const rootItems = [
      ...wiki.entries.filter(e => e.parentId === null),
      ...wiki.folders.filter(f => f.parentId === null),
    ]
    const maxOrder = rootItems.length
    // CHARACTER stays a first-class `character` binder type so the dedicated
    // profile renderer handles it; getHiveWikiView union-coerces character
    // rows back to CHARACTER-category wiki entries, so editor + hive stay
    // in sync on the user-facing model.
    const isCharacter = category === 'CHARACTER'
    const type = isCharacter ? 'character' : 'wiki_entry'
    const title = isCharacter ? 'Untitled Character' : `New ${template.label}`
    // One empty "Notes" section — see studio binder-add-menu sibling.
    const seededSections = isCharacter ? [] : [{ id: `s_${createId()}`, label: 'Notes', body: { type: 'doc', content: [{ type: 'paragraph' }] } }]
    const content = isCharacter
      ? null
      : ({
          category,
          sections: seededSections,
          tags: [],
          hints: {},
        } as unknown as Record<string, unknown>)
    startTransition(async () => {
      const r = await createBinderItemAction({
        bookId: wiki.bookId,
        parentId: null,
        type,
        title,
        order: maxOrder + 1,
        content,
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
    <div className="max-w-6xl mx-auto p-6">
      <div
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
        }}
        className="p-6 space-y-6 min-h-[calc(100vh-160px)]"
      >
        <header className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h1
              style={{ color: 'var(--brand)' }}
              className="font-comfortaa font-bold text-2xl"
            >
              Wiki
            </h1>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search title, tags, excerpt…"
                style={{
                  background: 'var(--canvas-dark-100)',
                  borderRadius: 'var(--r-row)',
                  boxShadow: 'var(--sh-inset)',
                  border: 'var(--br-card)',
                  color: 'var(--canvas-dark-ink)',
                }}
                className="w-full pl-9 pr-3 py-2 text-sm font-geist placeholder:text-[var(--canvas-dark-ink-muted)] focus:outline-none"
              />
            </div>
            <div className="flex gap-1" role="tablist">
              {(['category', 'folder', 'notes'] as ViewMode[]).map(m => {
                const isActive = viewMode === m
                return (
                  <button
                    key={m}
                    role="tab"
                    aria-selected={isActive}
                    type="button"
                    onClick={() => setViewMode(m)}
                    style={{
                      background: isActive
                        ? 'var(--brand)'
                        : 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                      color: isActive ? 'var(--brand-ink)' : 'var(--canvas-dark-ink)',
                      borderRadius: 'var(--r-pill)',
                      boxShadow: 'var(--sh-tile)',
                    }}
                    className={cn(
                      'px-4 py-1.5 text-xs font-geist font-semibold',
                    )}
                  >
                    {m === 'category' ? 'By Category' : m === 'folder' ? 'By Folder' : 'Notes'}
                  </button>
                )
              })}
            </div>
          </div>
        </header>

        {viewMode === 'category' && (
          <ByCategoryView
            entries={filteredEntries}
            canEdit={canEdit}
            isSearching={search.trim().length > 0}
            onOpenEntry={setSelectedEntryId}
            onAddEntryInCategory={handlePickCategory}
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

      </div>
    </div>
  )
}
