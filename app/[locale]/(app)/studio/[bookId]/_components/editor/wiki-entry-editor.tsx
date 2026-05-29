'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { CATEGORY_TEMPLATE_MAP, type WikiCategory } from '@/lib/wiki/category-templates'
import { normalizeTags } from '@/lib/wiki/tags'
import { TagChipStrip } from './tag-chip-strip'
import { SaveStatusBadge, type FormSaveStatus } from '../front-back-matter/save-status-badge'
import { useBookEditor } from '../book-editor-provider'

type WikiEntryContent = {
  category: WikiCategory
  body: unknown
  tags: string[]
}

function readContent(raw: unknown): WikiEntryContent {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { category: 'OTHER', body: { type: 'doc', content: [] }, tags: [] }
  }
  const c = raw as Partial<WikiEntryContent>
  return {
    category: (c.category ?? 'OTHER') as WikiCategory,
    body: c.body ?? { type: 'doc', content: [] },
    tags: Array.isArray(c.tags) ? c.tags : [],
  }
}

export function WikiEntryEditor({ item, readOnly = false }: { item: BinderItemRow; readOnly?: boolean }) {
  const { updateBinderItem } = useBookEditor()
  const initial = useMemo(() => readContent(item.content), [item.id])
  const contentRef = useRef<WikiEntryContent>(initial)
  const [content, setContent] = useState<WikiEntryContent>(initial)
  const [status, setStatus] = useState<FormSaveStatus>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const template = CATEGORY_TEMPLATE_MAP[content.category]

  const scheduleSave = useCallback((next: WikiEntryContent) => {
    if (readOnly) return
    contentRef.current = next
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setStatus('unsaved')
    saveTimer.current = setTimeout(async () => {
      setStatus('saving')
      const r = await updateBinderItemAction(item.id, { content: next as unknown as Record<string, unknown> })
      setStatus(r.success ? 'saved' : 'unsaved')
      if (r.success) updateBinderItem(item.id, { content: next })
    }, 800)
  }, [item.id, readOnly, updateBinderItem])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: { levels: [2] } })],
    content: initial.body as Parameters<typeof useEditor>[0]['content'],
    editable: !readOnly,
    onUpdate({ editor: e }) {
      if (e.isDestroyed) return
      const next: WikiEntryContent = { ...contentRef.current, body: e.getJSON() }
      setContent(next)
      scheduleSave(next)
    },
  }, [item.id])

  function setTags(tags: string[]) {
    const next: WikiEntryContent = { ...contentRef.current, tags: normalizeTags(tags) }
    setContent(next)
    scheduleSave(next)
  }

  async function commitTitle(title: string) {
    const trimmed = title.trim()
    if (!trimmed || trimmed === item.title) return
    const r = await updateBinderItemAction(item.id, { title: trimmed })
    if (r.success) updateBinderItem(item.id, { title: trimmed })
  }

  const IconComponent = template.icon

  return (
    <main
      data-slot="wiki-entry-pane"
      className="flex-1 overflow-y-auto"
      style={{ background: 'var(--sheet-canvas, var(--background))' }}
    >
      <style>{`
        [data-slot="wiki-entry-pane"] {
          --sheet-canvas: var(--background);
        }
        [data-editor-theme="light"] [data-slot="wiki-entry-pane"] {
          --sheet-canvas: var(--paper-200);
        }
      `}</style>
      <div className="mx-auto max-w-[760px] px-8 py-10 space-y-6">
        <header className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Wiki ▸ {template.label}
          </span>
          <SaveStatusBadge status={status} />
        </header>

        <section className="rounded-lg border border-border bg-card p-6 space-y-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
              style={{
                color: `var(${template.accentColor})`,
                background: `oklch(from var(${template.accentColor}) l c h / 0.14)`,
              }}
            >
              <IconComponent size={12} /> {template.label}
            </span>
          </div>
          <div
            role="textbox"
            contentEditable={!readOnly}
            suppressContentEditableWarning
            className="font-comfortaa font-bold text-2xl outline-none"
            onBlur={e => commitTitle(e.currentTarget.textContent ?? '')}
          >
            {item.title}
          </div>
          <TagChipStrip
            tags={content.tags}
            onChange={setTags}
            accentColor={template.accentColor}
            readOnly={readOnly}
          />
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <EditorContent editor={editor} />
        </section>

        {readOnly && (
          <p className="text-center text-xs text-muted-foreground">
            Read-only — your role is Beta Reader.
          </p>
        )}
      </div>
    </main>
  )
}
