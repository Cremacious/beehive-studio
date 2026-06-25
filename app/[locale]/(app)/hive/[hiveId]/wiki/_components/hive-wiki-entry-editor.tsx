'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus } from 'lucide-react'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { getBinderTreeForHiveAction } from '@/lib/actions/hive-content.actions'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import { CATEGORY_TEMPLATE_MAP, type WikiCategory } from '@/lib/wiki/category-templates'
import {
  migrateBodyToSections,
  newBlankSection,
  type WikiSection as Section,
} from '@/lib/wiki/sections'
import { normalizeTags } from '@/lib/wiki/tags'
import { toastActionError, toastNetworkError } from '@/lib/errors/notify'
import { TagChipStrip } from '@/app/[locale]/(app)/studio/[bookId]/_components/editor/tag-chip-strip'
import { WikiSection } from '@/app/[locale]/(app)/studio/[bookId]/_components/editor/wiki-section'
import { SaveStatusBadge, type FormSaveStatus } from '@/app/[locale]/(app)/studio/[bookId]/_components/front-back-matter/save-status-badge'
import type { HiveRole } from '@/lib/hive/permissions'
import { canEditWiki } from '@/lib/hive/permissions'

type WikiEntryContent = {
  category: WikiCategory
  sections: Section[]
  tags: string[]
  hints?: Record<string, string>
}

function readContent(raw: unknown): WikiEntryContent {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      category: 'OTHER',
      sections: [newBlankSection('Notes')],
      tags: [],
      hints: {},
    }
  }
  const c = raw as Partial<WikiEntryContent> & { body?: unknown }
  const category = (c.category ?? 'OTHER') as WikiCategory
  const tags = Array.isArray(c.tags) ? c.tags : []
  const hints = (c.hints && typeof c.hints === 'object' && !Array.isArray(c.hints))
    ? (c.hints as Record<string, string>)
    : {}
  if (Array.isArray(c.sections) && c.sections.length > 0) {
    return { category, sections: c.sections, tags, hints }
  }
  return {
    category,
    sections: migrateBodyToSections(c.body),
    tags,
    hints,
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
  // Characters are first-class `character` binder items (content typically
  // null since the dedicated character renderer owns its own shape on the
  // studio side). On the hive wiki surface we union-coerce them to the
  // CHARACTER category so the badge + blurb match the list view (matches
  // the shaping in getHiveWikiView). Without this override the editor
  // falls back to OTHER for character rows.
  const displayCategory: WikiCategory =
    item.type === 'character' ? 'CHARACTER' : content.category
  const template = CATEGORY_TEMPLATE_MAP[displayCategory]

  const scheduleSave = useCallback((next: WikiEntryContent) => {
    if (readOnly) return
    contentRef.current = next
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setStatus('unsaved')
    saveTimer.current = setTimeout(async () => {
      setStatus('saving')
      try {
        const r = await updateBinderItemAction(item.id, { content: next as unknown as Record<string, unknown> })
        // Never discard the user's edits on failure: keep the unsaved status so
        // the badge shows the save did not land, and surface the real error.
        setStatus(r.success ? 'saved' : 'unsaved')
        if (!r.success) toastActionError(r.error)
      } catch {
        setStatus('unsaved')
        toastNetworkError()
      }
    }, 800)
  }, [item.id, readOnly])

  function applyContent(next: WikiEntryContent) {
    setContent(next)
    scheduleSave(next)
  }

  function setTags(tags: string[]) {
    applyContent({ ...contentRef.current, tags: normalizeTags(tags) })
  }
  function setSection(next: Section) {
    const sections = contentRef.current.sections.map(s => s.id === next.id ? next : s)
    applyContent({ ...contentRef.current, sections })
  }
  function removeSection(id: string) {
    const sections = contentRef.current.sections.filter(s => s.id !== id)
    if (sections.length === 0) return
    applyContent({ ...contentRef.current, sections })
  }
  function addSection() {
    const section = newBlankSection('New section')
    applyContent({ ...contentRef.current, sections: [...contentRef.current.sections, section] })
  }

  async function commitTitle(title: string) {
    const trimmed = title.trim()
    if (!trimmed || trimmed === item.title || readOnly) return
    try {
      const r = await updateBinderItemAction(item.id, { title: trimmed })
      if (!r.success) toastActionError(r.error)
    } catch {
      toastNetworkError()
    }
  }

  const IconComponent = template.icon
  const onlyOneSection = content.sections.length <= 1

  return (
    <div data-slot="wiki-entry-pane">
      <style>{`
        [data-slot="wiki-entry-pane"] {
          --wiki-ink:           var(--canvas-dark-ink-strong);
          --wiki-ink-strong:    var(--canvas-dark-ink-strong);
          --wiki-ink-muted:     var(--canvas-dark-ink);
          --wiki-ink-faint:     var(--canvas-dark-ink-faint);
          --wiki-body-bg:       linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300));
          --wiki-body-border-color: oklch(1 0 0 / 0.40);
          --wiki-body-shadow:   var(--sh-tile), inset 0 1px 0 oklch(1 0 0 / 0.04);
          --wiki-title-hover-bg: oklch(1 0 0 / 0.02);
          --wiki-title-hover-bd: 1px solid oklch(1 0 0 / 0.06);
          --wiki-label-color:   var(--brand);
          --wiki-label-hover-bg: oklch(1 0 0 / 0.03);
          --wiki-label-hover-bd: 1px solid oklch(1 0 0 / 0.08);
          --wiki-add-border:    1px dashed oklch(1 0 0 / 0.18);
          --wiki-add-hover-color: var(--brand);
          --wiki-ring:          oklch(from var(--brand) l c h / 0.55);
        }
        [data-editor-theme="light"] [data-slot="wiki-entry-pane"] {
          background: var(--paper-300) !important;
          --wiki-ink:           var(--paper-ink-strong);
          --wiki-ink-strong:    var(--paper-ink-strong);
          --wiki-ink-muted:     var(--paper-ink);
          --wiki-ink-faint:     var(--paper-ink-muted);
          --wiki-body-bg:       var(--paper-50);
          --wiki-body-border-color: oklch(0 0 0 / 0.32);
          --wiki-body-shadow:   0 1px 0 var(--paper-200), 0 4px 12px -6px oklch(0 0 0 / 0.10);
          --wiki-title-hover-bg: oklch(0 0 0 / 0.025);
          --wiki-title-hover-bd: 1px solid oklch(0 0 0 / 0.08);
          --wiki-label-color:   oklch(0.52 0.14 75);
          --wiki-label-hover-bg: oklch(0 0 0 / 0.035);
          --wiki-label-hover-bd: 1px solid oklch(0 0 0 / 0.12);
          --wiki-add-border:    1px dashed oklch(0 0 0 / 0.20);
          --wiki-add-hover-color: oklch(0.52 0.14 75);
          --wiki-ring:          oklch(from var(--brand) l c h / 0.5);
        }

        [data-slot="wiki-entry-pane"] .wiki-ink         { color: var(--wiki-ink); }
        [data-slot="wiki-entry-pane"] .wiki-ink-strong  { color: var(--wiki-ink-strong); }
        [data-slot="wiki-entry-pane"] .wiki-ink-muted   { color: var(--wiki-ink-muted); }
        [data-slot="wiki-entry-pane"] .wiki-ink-faint   { color: var(--wiki-ink-faint); }

        [data-slot="wiki-entry-pane"] .wiki-title-field {
          display: block; margin: 0 auto; max-width: 600px;
          font-family: var(--font-display);
          font-weight: 700; font-size: 32px;
          letter-spacing: -0.02em; line-height: 1.15;
          text-align: center;
          color: var(--wiki-ink-strong);
          background: transparent;
          border: 1px solid transparent;
          border-radius: 12px;
          padding: 6px 14px;
          outline: none;
          transition: background 0.15s, border-color 0.15s;
        }
        [data-slot="wiki-entry-pane"] .wiki-title-field:hover {
          background: var(--wiki-title-hover-bg);
          border: var(--wiki-title-hover-bd);
        }
        [data-slot="wiki-entry-pane"] .wiki-title-field[data-empty="true"]::before {
          content: attr(data-placeholder);
          color: var(--wiki-ink-faint);
          font-style: italic;
        }

        [data-slot="wiki-entry-pane"] .wiki-section-label {
          font-family: ui-monospace, "SF Mono", monospace;
          font-size: 11px; letter-spacing: 0.10em;
          text-transform: uppercase; font-weight: 700;
          color: var(--wiki-label-color);
          background: transparent;
          border: 1px solid transparent;
          border-radius: 6px;
          padding: 2px 6px;
          outline: none;
          transition: background 0.15s, border-color 0.15s;
          cursor: text;
        }
        [data-slot="wiki-entry-pane"] .wiki-section-label:hover,
        [data-slot="wiki-entry-pane"] .wiki-section-label:focus {
          background: var(--wiki-label-hover-bg);
          border: var(--wiki-label-hover-bd);
        }
        [data-slot="wiki-entry-pane"] .wiki-section-hint {
          color: var(--wiki-ink-faint);
        }

        [data-slot="wiki-entry-pane"] .wiki-section-remove {
          color: var(--wiki-ink-faint); cursor: pointer;
        }
        [data-slot="wiki-entry-pane"] .wiki-section-remove:hover {
          color: var(--wiki-ink-strong);
        }

        [data-slot="wiki-entry-pane"] .wiki-add-section {
          width: 100%; padding: 14px;
          background: transparent;
          border: var(--wiki-add-border);
          border-radius: 14px;
          color: var(--wiki-ink-muted);
          font-family: var(--font-display);
          font-weight: 600; font-size: 12px;
          letter-spacing: 0.02em;
          cursor: pointer;
          transition: filter 0.15s, border-color 0.15s, color 0.15s;
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        }
        [data-slot="wiki-entry-pane"] .wiki-add-section:hover {
          border-color: var(--brand); color: var(--wiki-add-hover-color);
        }

        [data-slot="wiki-entry-pane"] .wiki-section-body .ProseMirror {
          color: var(--wiki-ink); caret-color: var(--brand);
          outline: none; min-height: 60px;
          font-size: 14px; line-height: 1.7;
        }
        [data-slot="wiki-entry-pane"] .wiki-section-body .ProseMirror strong { color: var(--wiki-ink-strong); font-weight: 600; }
        [data-slot="wiki-entry-pane"] .wiki-section-body .ProseMirror em { font-style: italic; }
        [data-slot="wiki-entry-pane"] .wiki-section-body .ProseMirror blockquote {
          color: var(--wiki-ink-muted);
          border-left: 3px solid oklch(from var(--brand) l c h / 0.55);
          padding-left: 0.9em; margin: 0.8em 0;
        }
        [data-slot="wiki-entry-pane"] .wiki-section-body .ProseMirror p { margin: 0 0 0.85em; text-wrap: pretty; }
        [data-slot="wiki-entry-pane"] .wiki-section-body .ProseMirror p:last-child { margin-bottom: 0; }
        [data-slot="wiki-entry-pane"] .wiki-section-body .ProseMirror ul,
        [data-slot="wiki-entry-pane"] .wiki-section-body .ProseMirror ol { padding-left: 1.4em; margin: 0 0 0.85em; }
        [data-slot="wiki-entry-pane"] .wiki-section-body .ProseMirror ul { list-style: disc; }
        [data-slot="wiki-entry-pane"] .wiki-section-body .ProseMirror ol { list-style: decimal; }
        [data-slot="wiki-entry-pane"] .wiki-section-body .ProseMirror li { margin: 0.25em 0; }

        [data-slot="wiki-entry-pane"] .wiki-section-body .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left; height: 0; pointer-events: none;
          font-style: italic;
          color: var(--wiki-ink-faint);
        }
      `}</style>

      <div className="mx-auto max-w-[840px] p-8">
        <header
          className="wiki-ink-muted flex items-center justify-end gap-3 pb-5"
          style={{ borderBottom: '1px solid oklch(from var(--canvas-dark-300) l c h / 0.5)' }}
        >
          <span className="text-[10px] font-mono uppercase tracking-[0.08em]">
            {authorUsername ? `Edited by @${authorUsername} · ` : ''}{relTime(lastEditedAt)}
          </span>
          {!readOnly && <SaveStatusBadge status={status} />}
        </header>

        <section className="space-y-2 pt-7 text-center">
          <div className="flex items-center justify-center gap-2 group">
            <div
              role="textbox"
              aria-label="Entry title (click to rename)"
              contentEditable={!readOnly}
              suppressContentEditableWarning
              data-placeholder="Untitled entry"
              data-empty={item.title ? 'false' : 'true'}
              className="wiki-title-field"
              onBlur={e => commitTitle(e.currentTarget.textContent ?? '')}
            >
              {item.title}
            </div>
            {!readOnly && (
              <span
                aria-hidden
                title="Click the title to rename"
                className="wiki-ink-muted opacity-50 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <Pencil size={16} />
              </span>
            )}
          </div>
          {!readOnly && (
            <p className="wiki-ink-muted text-[11px] italic">
              Click the title above to rename this entry.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-[11px] py-[3px] text-[10px] font-mono font-medium uppercase tracking-[0.10em]"
              style={{
                color: `var(${template.accentColor})`,
                background: `oklch(from var(${template.accentColor}) l c h / 0.14)`,
                border: `1px solid oklch(from var(${template.accentColor}) l c h / 0.3)`,
              }}
            >
              <IconComponent size={12} /> {template.label}
            </span>
            <TagChipStrip
              tags={content.tags}
              onChange={setTags}
              accentColor={template.accentColor}
              readOnly={readOnly}
              disableAdd
            />
          </div>
          <p className="wiki-ink-muted text-center text-sm italic max-w-[560px] mx-auto leading-relaxed mt-4">
            {template.blurb}
          </p>
        </section>

        <section className="space-y-2 pt-8">
          {readOnly && (
            <div className="flex justify-end px-1">
              <span className="wiki-ink-muted text-[10px] font-mono uppercase tracking-[0.10em] font-semibold">
                Read-only
              </span>
            </div>
          )}

          <div className="flex flex-col gap-[22px]">
            {content.sections.map(section => (
              <WikiSection
                key={section.id}
                section={section}
                placeholder={content.hints?.[section.id] ?? 'Add some notes…'}
                readOnly={readOnly}
                hideRemove={onlyOneSection}
                onChange={setSection}
                onRemove={() => removeSection(section.id)}
              />
            ))}
          </div>

          {!readOnly && (
            <div className="pt-[22px] space-y-[14px]">
              <button type="button" onClick={addSection} className="wiki-add-section">
                <Plus size={14} /> Add section
              </button>
              <p className="wiki-ink-strong text-center text-[12px] leading-relaxed max-w-[520px] mx-auto">
                Build your wiki entry your way. Use{' '}
                <strong>Add section</strong> to create new sections like
                {' '}<em>Personality</em>, <em>Physical Details</em>, or{' '}
                <em>Relationships</em>. Click any section label to rename it,
                hover a section to remove it.
              </p>
            </div>
          )}
        </section>

        {readOnly && (
          <p className="wiki-ink-muted text-center text-xs">
            Read-only. Your role is Beta Reader.
          </p>
        )}
      </div>
    </div>
  )
}
