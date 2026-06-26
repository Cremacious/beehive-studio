'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FileText,
  ScrollText,
  Folder,
  StickyNote,
  User as UserIcon,
  Layout as LayoutIcon,
  BookOpen,
  NotebookPen,
  FolderTree,
  type LucideIcon,
} from 'lucide-react'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { useBookEditor } from '../book-editor-provider'
import { EmptyState } from '../empty-state'
import { SaveStatusBadge, type FormSaveStatus } from '../front-back-matter/save-status-badge'
import { toastActionError, toastNetworkError } from '@/lib/errors/notify'

type WikiFolderContent = { description?: string }

function readContent(raw: unknown): WikiFolderContent {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const c = raw as Partial<WikiFolderContent>
  return { description: typeof c.description === 'string' ? c.description : undefined }
}

const TYPE_META: Record<string, { label: string; Icon: LucideIcon; tint: string }> = {
  chapter:         { label: 'Chapter',         Icon: FileText,    tint: 'var(--type-chapter)' },
  part:            { label: 'Collection',      Icon: BookOpen,    tint: 'var(--type-chapter)' },
  front_matter:    { label: 'Front matter',    Icon: ScrollText,  tint: 'var(--type-front-matter)' },
  back_matter:     { label: 'Back matter',     Icon: ScrollText,  tint: 'var(--type-back-matter)' },
  research_folder: { label: 'Research folder', Icon: Folder,      tint: 'var(--type-research)' },
  research_note:   { label: 'Research note',   Icon: StickyNote,  tint: 'var(--type-research)' },
  character:       { label: 'Character',       Icon: UserIcon,    tint: 'var(--type-character)' },
  outline:         { label: 'Outline',         Icon: LayoutIcon,  tint: 'var(--type-outline)' },
  wiki_entry:      { label: 'Wiki entry',      Icon: NotebookPen, tint: 'var(--wiki-other)' },
  wiki_folder:     { label: 'Wiki folder',     Icon: FolderTree,  tint: 'var(--wiki-other)' },
}

export function WikiFolderRenderer({ item, readOnly = false }: { item: BinderItemRow; readOnly?: boolean }) {
  const { binderItems, setActiveItemId, updateBinderItem } = useBookEditor()
  const initial = useMemo(() => readContent(item.content), [item.id])
  const [description, setDescription] = useState(initial.description ?? '')
  const [status, setStatus] = useState<FormSaveStatus>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  const scheduleSave = useCallback((next: string) => {
    if (readOnly) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setStatus('unsaved')
    saveTimer.current = setTimeout(async () => {
      setStatus('saving')
      const content = { description: next || undefined } as unknown as Record<string, unknown>
      try {
        const r = await updateBinderItemAction(item.id, { content })
        // Keep the user's local description on failure; just surface the error.
        setStatus(r.success ? 'saved' : 'unsaved')
        if (r.success) updateBinderItem(item.id, { content })
        else toastActionError(r.error)
      } catch {
        setStatus('unsaved')
        toastNetworkError()
      }
    }, 800)
  }, [item.id, readOnly, updateBinderItem])

  const children = useMemo(
    () => binderItems.filter(i => i.parentId === item.id).sort((a, b) => a.order - b.order),
    [binderItems, item.id],
  )

  const themeStyles = (
    <style>{`
      [data-slot="wiki-folder-pane"] {
        --container-bg:        oklch(0.22 0.005 256);
        --container-ink:       var(--canvas-dark-ink);
        --container-ink-muted: var(--canvas-dark-ink-muted);
        --card-bg:             var(--paper-100);
        --card-bg-hover:       var(--paper-50);
        --card-border:         var(--paper-300);
        --card-ink:            var(--paper-ink-strong);
        --card-ink-muted:      var(--paper-ink-muted);
      }
      [data-editor-theme="light"] [data-slot="wiki-folder-pane"] {
        --container-bg:        var(--paper-300);
        --container-ink:       var(--paper-ink-strong);
        --container-ink-muted: var(--paper-ink-muted);
        --card-bg:             var(--paper-50);
        --card-bg-hover:       var(--paper-100);
        --card-border:         var(--paper-200);
        --card-ink:            var(--paper-ink-strong);
        --card-ink-muted:      var(--paper-ink-muted);
      }
    `}</style>
  )

  return (
    <main
      data-slot="wiki-folder-pane"
      className="flex-1 overflow-y-auto"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        border: 'var(--br-card)',
      }}
    >
      {themeStyles}
      <style>{`
        [data-editor-theme="light"] [data-slot="wiki-folder-pane"] {
          background: var(--container-bg) !important;
        }
      `}</style>
      <div className="max-w-3xl mx-auto px-8 py-10">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="inline-flex items-center justify-center rounded-md flex-shrink-0"
              style={{
                width: 36,
                height: 36,
                background: 'oklch(from var(--wiki-other) l c h / 0.14)',
                color: 'var(--wiki-other)',
              }}
            >
              <FolderTree size={18} />
            </span>
            <div className="min-w-0">
              <div
                className="text-[10px] uppercase tracking-[0.14em]"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--container-ink-muted)' }}
              >
                Wiki folder · {children.length} {children.length === 1 ? 'item' : 'items'}
              </div>
              <h1
                className="m-0 truncate"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 26,
                  fontWeight: 700,
                  letterSpacing: '-0.015em',
                  color: 'var(--container-ink)',
                }}
              >
                {item.title}
              </h1>
            </div>
          </div>
          <SaveStatusBadge status={status} />
        </div>

        <textarea
          value={description}
          onChange={e => {
            const v = e.target.value
            setDescription(v)
            scheduleSave(v)
          }}
          placeholder={readOnly ? '' : 'Describe what lives in this folder…'}
          rows={2}
          readOnly={readOnly}
          className="w-full resize-none bg-transparent outline-none text-sm leading-relaxed mb-7"
          style={{ color: 'var(--container-ink)', fontFamily: 'var(--font-prose)' }}
        />

        {children.length === 0 ? (
          <EmptyState
            icon={<FolderTree size={20} />}
            title="This wiki folder is empty"
            body="Add a wiki entry, character, or sub-folder from the + Add menu in the binder."
            onEditorCanvas
          />
        ) : (
          <ul
            className="grid gap-3.5"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))' }}
          >
            {children.map(child => {
              const meta = TYPE_META[child.type] ?? { label: child.type, Icon: FileText, tint: 'var(--card-ink-muted)' }
              const Icon = meta.Icon
              return (
                <li key={child.id}>
                  <button
                    type="button"
                    onClick={() => setActiveItemId(child.id)}
                    className="group w-full text-left border transition-all px-4 py-3.5 flex items-start gap-3 cursor-pointer hover:-translate-y-px"
                    style={{
                      background: 'var(--card-bg)',
                      borderColor: 'var(--card-border)',
                      borderRadius: 'var(--r-row)',
                      boxShadow: 'var(--sh-tile)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'var(--card-bg-hover)'
                      e.currentTarget.style.borderColor = 'oklch(from var(--color-brand) l c h / 0.5)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'var(--card-bg)'
                      e.currentTarget.style.borderColor = 'var(--card-border)'
                    }}
                  >
                    <span
                      className="mt-0.5 flex-shrink-0 inline-flex items-center justify-center"
                      style={{ color: meta.tint }}
                    >
                      <Icon size={16} />
                    </span>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span
                        className="text-[14px] font-semibold leading-tight truncate"
                        style={{ fontFamily: 'var(--font-display)', color: 'var(--card-ink)' }}
                      >
                        {child.title || 'Untitled'}
                      </span>
                      <span
                        className="text-[10px] uppercase tracking-[0.10em] leading-tight mt-1.5"
                        style={{ fontFamily: 'var(--font-mono)', color: 'var(--card-ink-muted)' }}
                      >
                        {meta.label}
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </main>
  )
}
