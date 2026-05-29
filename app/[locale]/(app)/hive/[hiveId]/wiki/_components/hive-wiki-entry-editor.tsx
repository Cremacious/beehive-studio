'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { ChevronLeft } from 'lucide-react'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { getBinderTreeForHiveAction } from '@/lib/actions/hive-content.actions'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import { CATEGORY_TEMPLATE_MAP, type WikiCategory } from '@/lib/wiki/category-templates'
import { normalizeTags } from '@/lib/wiki/tags'
import { TagChipStrip } from '@/app/[locale]/(app)/studio/[bookId]/_components/editor/tag-chip-strip'
import { SaveStatusBadge, type FormSaveStatus } from '@/app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/save-status-badge'
import type { HiveRole } from '@/lib/hive/permissions'
import { canEditWiki } from '@/lib/hive/permissions'

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

function relTime(d: Date): string {
  const seconds = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function HiveWikiEntryEditor({
  entryId,
  bookId,
  hiveId,
  viewerRole,
  authorUsername,
  lastEditedAt,
  onBack,
}: {
  entryId: string
  bookId: string
  hiveId: string
  viewerRole: HiveRole
  authorUsername: string | null
  lastEditedAt: Date
  onBack: () => void
}) {
  const router = useRouter()
  const readOnly = !canEditWiki(viewerRole)
  const [item, setItem] = useState<BinderItemRow | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    getBinderTreeForHiveAction(bookId, hiveId).then(r => {
      if (cancelled) return
      if (!r.success) { setLoadError(true); return }
      setItem(r.data.find(i => i.id === entryId) ?? null)
    })
    return () => { cancelled = true }
  }, [bookId, hiveId, entryId])

  if (loadError) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Failed to load entry.
      </div>
    )
  }
  if (!item) {
    return <div className="p-8 text-center text-muted-foreground">Loading…</div>
  }

  return (
    <HiveWikiEntryEditorInner
      key={item.id}
      item={item}
      readOnly={readOnly}
      authorUsername={authorUsername}
      lastEditedAt={lastEditedAt}
      onBack={() => { onBack(); router.refresh() }}
    />
  )
}

function HiveWikiEntryEditorInner({
  item,
  readOnly,
  authorUsername,
  lastEditedAt,
  onBack,
}: {
  item: BinderItemRow
  readOnly: boolean
  authorUsername: string | null
  lastEditedAt: Date
  onBack: () => void
}) {
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
    }, 800)
  }, [item.id, readOnly])

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
    if (!trimmed || trimmed === item.title || readOnly) return
    await updateBinderItemAction(item.id, { title: trimmed })
  }

  const IconComponent = template.icon

  return (
    <main
      data-slot="wiki-entry-pane"
      className="flex-1 overflow-y-auto"
      style={{ background: 'var(--wiki-canvas)' }}
    >
      <style>{`
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
          <button
            type="button"
            onClick={onBack}
            className="wiki-breadcrumb text-[11px] uppercase tracking-wide inline-flex items-center gap-1 hover:text-brand"
          >
            <ChevronLeft size={12} /> Back to wiki
          </button>
          <SaveStatusBadge status={status} />
        </header>

        <section className="wiki-card rounded-lg p-6 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
              style={{
                color: `var(${template.accentColor})`,
                background: `oklch(from var(${template.accentColor}) l c h / 0.14)`,
              }}
            >
              <IconComponent size={12} /> {template.label}
            </span>
            <span className="wiki-breadcrumb text-[10px]">
              {authorUsername ? `Last edited by @${authorUsername} · ` : ''}{relTime(lastEditedAt)}
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
