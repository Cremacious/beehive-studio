'use client'

import { useState, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import type { WikiPageSummary, WikiPageFull } from '@/lib/actions/hive-content.actions'
import { createWikiPageAction, saveWikiPageAction } from '@/lib/actions/hive-content.actions'
import { cn } from '@/lib/utils'

type Props = {
  hiveId: string
  pages: WikiPageSummary[]
  activePage: WikiPageFull | null
}

export function HiveWiki({ hiveId, pages: initialPages, activePage }: Props) {
  const [pages, setPages] = useState(initialPages)
  const [newPageTitle, setNewPageTitle] = useState('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing this wiki page…' }),
    ],
    content: activePage?.content ? JSON.parse(activePage.content) : null,
    onUpdate: ({ editor }) => {
      if (!activePage) return
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        await saveWikiPageAction(activePage.id, JSON.stringify(editor.getJSON()))
      }, 2000)
    },
    editorProps: { attributes: { class: 'outline-none min-h-full' } },
  }, [activePage?.id])

  async function handleCreatePage() {
    if (!newPageTitle.trim()) return
    const result = await createWikiPageAction(hiveId, newPageTitle.trim())
    if (result.success) {
      setPages(prev => [...prev, { id: result.data.pageId, title: newPageTitle.trim(), updatedAt: new Date() }])
      setNewPageTitle('')
    }
  }

  return (
    <div className="flex h-full">
      <div className="w-52 border-r border-border bg-card flex flex-col flex-shrink-0">
        <div className="p-2 border-b border-border">
          <div className="flex gap-1">
            <input
              value={newPageTitle}
              onChange={e => setNewPageTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreatePage()}
              placeholder="New page title…"
              className="flex-1 bg-surface-inset border border-border rounded px-2 py-1 text-xs outline-none focus:border-brand/40"
            />
            <button onClick={handleCreatePage} className="text-xs px-2 py-1 rounded bg-brand text-black font-medium">+</button>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
          {pages.map(p => (
            <a
              key={p.id}
              href={`./wiki/${p.id}`}
              className={cn(
                'px-2 py-1.5 rounded-md text-xs truncate transition-colors',
                activePage?.id === p.id
                  ? 'bg-brand/10 text-brand'
                  : 'text-foreground/60 hover:text-foreground hover:bg-surface-elevated',
              )}
            >
              {p.title}
            </a>
          ))}
        </nav>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        {activePage ? (
          <>
            <div className="px-4 py-2 border-b border-border bg-surface text-xs text-muted-foreground flex items-center justify-between">
              <span className="font-medium text-foreground">{activePage.title}</span>
              <span className="text-foreground/40">Auto-saves</span>
            </div>
            <EditorContent
              editor={editor}
              className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto prose prose-invert prose-sm w-full"
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Select a page or create one.
          </div>
        )}
      </div>
    </div>
  )
}
