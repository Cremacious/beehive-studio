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
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        border: 'var(--br-card)',
      }}
    >
      <style>{`
        [data-editor-theme="light"] [data-slot="wiki-entry-pane"] {
          background: var(--wiki-canvas) !important;
        }
        [data-slot="wiki-entry-pane"] {
          --wiki-canvas:    oklch(0.22 0.005 256);
          --wiki-card-bg:   var(--paper-100);
          --wiki-card-bord: var(--paper-300);
          --wiki-ink:       var(--paper-ink);
          --wiki-ink-strong:var(--paper-ink-strong);
          --wiki-ink-muted: var(--paper-ink-muted);
        }
        [data-editor-theme="light"] [data-slot="wiki-entry-pane"] {
          --wiki-canvas:    var(--paper-300);
          --wiki-card-bg:   var(--paper-50);
          --wiki-card-bord: var(--paper-200);
        }
        [data-slot="wiki-entry-pane"] .wiki-card {
          background: var(--wiki-card-bg);
          border: 1px solid var(--wiki-card-bord);
        }
        [data-slot="wiki-entry-pane"] .wiki-title { color: var(--wiki-ink-strong); }
        [data-slot="wiki-entry-pane"] .wiki-breadcrumb { color: var(--wiki-ink-muted); }
        [data-slot="wiki-entry-pane"] .ProseMirror { color: var(--wiki-ink); caret-color: var(--color-brand); outline: none; }
        [data-slot="wiki-entry-pane"] .ProseMirror h2 { color: var(--wiki-ink-strong); font-family: var(--font-display); font-size: 20px; font-weight: 700; margin: 1.2em 0 0.4em; }
        [data-slot="wiki-entry-pane"] .ProseMirror h2:first-child { margin-top: 0; }
        [data-slot="wiki-entry-pane"] .ProseMirror strong { color: var(--wiki-ink-strong); font-weight: 600; }
        [data-slot="wiki-entry-pane"] .ProseMirror em { font-style: italic; }
        [data-slot="wiki-entry-pane"] .ProseMirror blockquote { color: var(--wiki-ink-muted); border-left: 3px solid oklch(0.78 0.04 60 / 0.45); padding-left: 0.9em; margin: 0.6em 0; }
        [data-slot="wiki-entry-pane"] .ProseMirror p { margin: 0 0 1em; text-wrap: pretty; }
        [data-slot="wiki-entry-pane"] .ProseMirror ul,
        [data-slot="wiki-entry-pane"] .ProseMirror ol { padding-left: 1.4em; margin: 0 0 1em; }
        [data-slot="wiki-entry-pane"] .ProseMirror ul { list-style: disc; }
        [data-slot="wiki-entry-pane"] .ProseMirror ol { list-style: decimal; }
        [data-slot="wiki-entry-pane"] .ProseMirror li { margin: 0.3em 0; }
      `}</style>
      <div className="mx-auto max-w-[760px] px-8 py-10 space-y-6">
        <header className="flex items-center justify-between">
          <span className="wiki-breadcrumb text-[11px] uppercase tracking-wide">
            Wiki ▸ {template.label}
          </span>
          <SaveStatusBadge status={status} />
        </header>

        <section className="wiki-card rounded-lg p-6 space-y-3">
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
            className="wiki-title font-comfortaa font-bold text-2xl outline-none"
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

        <section className="wiki-card rounded-lg p-6">
          <EditorContent editor={editor} />
        </section>

        {readOnly && (
          <p className="wiki-breadcrumb text-center text-xs">
            Read-only — your role is Beta Reader.
          </p>
        )}
      </div>
    </main>
  )
}
