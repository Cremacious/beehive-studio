'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBookEditor } from '../book-editor-provider'
import { EmptyState } from '../empty-state'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import {
  getPublishingMetadataAction,
  updatePublishingMetadataAction,
  type PublishingMetadata,
} from '@/lib/actions/publishing.actions'

const CHAPTER_TYPES = new Set(['chapter', 'front_matter', 'back_matter'])

const STATUS_OPTIONS = [
  { value: 'IDEA' as const, label: 'Idea', color: 'var(--status-idea)' },
  { value: 'OUTLINE' as const, label: 'Outline', color: 'var(--status-outline)' },
  { value: 'FIRST_DRAFT' as const, label: 'First Draft', color: 'var(--status-first-draft)' },
  { value: 'REVISED' as const, label: 'Revised', color: 'var(--status-revised)' },
  { value: 'FINAL' as const, label: 'Final', color: 'var(--status-final)' },
]

type ChapterMeta = {
  synopsis?: string
  sceneGoal?: string
  sceneConflict?: string
  sceneOutcome?: string
}

function EmptyPlaceholder() {
  return <EmptyState title="No chapter selected" body="Select a chapter to see details." />
}

function ChapterMetadata() {
  const { activeItem, activeItemId, activeChapter, updateChapterStatus, updateChapterNotes, updateBinderItem } = useBookEditor()
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [scenePlannerOpen, setScenePlannerOpen] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const metaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const meta: ChapterMeta =
    activeItem?.content && typeof activeItem.content === 'object' && !Array.isArray(activeItem.content)
      ? (activeItem.content as ChapterMeta)
      : {}

  function handleMetaChange(patch: Partial<ChapterMeta>) {
    if (metaTimerRef.current) clearTimeout(metaTimerRef.current)
    const newMeta = { ...meta, ...patch }
    updateBinderItem(activeItem!.id, { content: newMeta })
    metaTimerRef.current = setTimeout(async () => {
      await updateBinderItemAction(activeItem!.id, { content: newMeta })
    }, 1500)
  }

  useEffect(() => {
    if (isEditingTitle) titleInputRef.current?.focus()
  }, [isEditingTitle])

  async function commitTitle() {
    const title = titleInputRef.current!.value.trim() || activeItem!.title
    await updateBinderItemAction(activeItem!.id, { title })
    updateBinderItem(activeItem!.id, { title })
    setIsEditingTitle(false)
  }

  function handleNotesChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    updateChapterNotes(e.target.value)
  }

  const labelClass = "text-[10px] text-muted-foreground uppercase tracking-[0.10em] font-medium font-mono"
  const fieldClass = "resize-none bg-surface-inset rounded-md p-2.5 text-xs text-foreground outline-none border border-border focus:border-brand/40 transition-colors leading-relaxed placeholder:italic placeholder:text-muted-foreground"

  return (
    <div className="flex flex-col">
      <div className="px-[18px] py-[18px] border-b border-[var(--chrome-800)]">
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            defaultValue={activeItem!.title}
            className="text-lg font-bold text-foreground bg-transparent border-b border-foreground/40 outline-none w-full font-[family-name:var(--font-display)]"
            onKeyDown={e => {
              if (e.key === 'Enter') commitTitle()
              if (e.key === 'Escape') setIsEditingTitle(false)
            }}
            onBlur={commitTitle}
          />
        ) : (
          <h2
            className="text-lg font-bold text-foreground cursor-pointer hover:text-brand transition-colors leading-tight font-[family-name:var(--font-display)]"
            onClick={() => setIsEditingTitle(true)}
          >
            {activeItem!.title}
          </h2>
        )}
      </div>

      <div className="px-[18px] py-[18px] border-b border-[var(--chrome-800)] flex flex-col gap-2.5">
        <span className={labelClass}>Status</span>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map(({ value, label, color }) => {
            const isActive = activeChapter?.status === value
            return (
              <button
                key={value}
                onClick={() => updateChapterStatus(value)}
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors font-medium",
                  !isActive && "bg-[var(--chrome-800)] text-foreground/80 border-[var(--chrome-700)] hover:text-foreground",
                )}
                style={
                  isActive
                    ? {
                        color,
                        backgroundColor: `oklch(from ${color} l c h / 0.18)`,
                        borderColor: `oklch(from ${color} l c h / 0.40)`,
                      }
                    : undefined
                }
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="px-[18px] py-[18px] border-b border-[var(--chrome-800)] flex flex-col gap-2.5">
        <span className={labelClass}>Synopsis</span>
        <textarea
          key={activeItemId + '-synopsis'}
          className={cn(fieldClass, "min-h-16")}
          placeholder="One-line chapter summary…"
          defaultValue={meta.synopsis ?? ''}
          onChange={e => handleMetaChange({ synopsis: e.target.value })}
        />
      </div>

      {activeItem!.type === 'chapter' && (
        <div className="px-[18px] py-[18px] border-b border-[var(--chrome-800)] flex flex-col gap-2.5">
          <button
            onClick={() => setScenePlannerOpen(o => !o)}
            className="flex items-center justify-between w-full text-xs text-foreground/80 font-medium hover:text-foreground transition-colors"
          >
            <span className={labelClass}>Scene Planner</span>
            {scenePlannerOpen ? (
              <ChevronDown size={14} className="text-muted-foreground" />
            ) : (
              <ChevronRight size={14} className="text-muted-foreground" />
            )}
          </button>
          {scenePlannerOpen && (
            <div className="flex flex-col gap-2.5 mt-1">
              {[
                { key: 'sceneGoal', label: 'Goal', placeholder: "What does the POV character want?" },
                { key: 'sceneConflict', label: 'Conflict', placeholder: "What stands in their way?" },
                { key: 'sceneOutcome', label: 'Outcome', placeholder: "How does the scene end?" },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="flex flex-col gap-1">
                  <span className={labelClass}>{label}</span>
                  <textarea
                    key={activeItemId + '-' + key}
                    className={cn(fieldClass, "min-h-12")}
                    placeholder={placeholder}
                    defaultValue={(meta as Record<string, string>)[key] ?? ''}
                    onChange={e => handleMetaChange({ [key]: e.target.value } as Partial<ChapterMeta>)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="px-[18px] py-[18px] flex flex-col gap-2.5 flex-1">
        <span className={labelClass}>Notes</span>
        <textarea
          key={activeItemId}
          className={cn(fieldClass, "flex-1 min-h-24 p-3")}
          placeholder="Private notes — only you can see these."
          defaultValue={activeChapter?.notes ?? ''}
          onChange={handleNotesChange}
        />
      </div>
    </div>
  )
}

function PublishingSection({ bookId }: { bookId: string }) {
  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [upgradePrompt, setUpgradePrompt] = useState(false)
  const [fields, setFields] = useState<Partial<PublishingMetadata>>({})

  async function handleExpand() {
    if (expanded) {
      setExpanded(false)
      return
    }
    if (!loaded) {
      // Fetch first, then expand — inputs mount with data already in fields
      const result = await getPublishingMetadataAction(bookId)
      if (result.success) setFields(result.data)
      setLoaded(true)
    }
    setExpanded(true)
  }

  // Fields that accept null (nullable in schema): isbn, subtitle, authorBio, dedication, publisherName
  // Fields that are optional-only (no null): trimSize, edition
  const NULLABLE_FIELDS = new Set<keyof PublishingMetadata>(['isbn', 'subtitle', 'authorBio', 'dedication', 'publisherName'])

  async function handleBlur(field: keyof PublishingMetadata, value: string) {
    setSaving(true)
    setUpgradePrompt(false)
    const trimmed = value.trim()
    const coerced = NULLABLE_FIELDS.has(field) ? (trimmed || null) : (trimmed || undefined)
    const result = await updatePublishingMetadataAction(bookId, { [field]: coerced })
    setSaving(false)
    if (!result.success && result.error?.startsWith('PREMIUM_REQUIRED')) {
      setUpgradePrompt(true)
    }
  }

  const pubLabelClass = "block text-[10px] text-muted-foreground mb-1 uppercase tracking-[0.10em] font-mono"
  const pubFieldClass = "w-full rounded border border-border bg-[var(--chrome-950)] px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground placeholder:italic focus:border-brand/40 focus:outline-none transition-colors"

  return (
    <div
      className="mt-auto border-t border-[var(--chrome-800)]"
      style={{ background: 'linear-gradient(180deg, var(--chrome-900), oklch(0.16 0.012 60))' }}
    >
      <button
        onClick={handleExpand}
        className="flex w-full items-start justify-between px-[18px] pt-3.5 pb-1 text-left hover:bg-surface-elevated/30 transition-colors"
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown size={14} className="text-muted-foreground" />
            ) : (
              <ChevronRight size={14} className="text-muted-foreground" />
            )}
            <span className="text-xs font-bold text-foreground/90 font-[family-name:var(--font-display)]">
              Publishing details
            </span>
            <span
              className="rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.10em] font-mono"
              style={{
                backgroundColor: 'var(--brand)',
                color: 'var(--brand-ink)',
                borderColor: 'var(--brand)',
              }}
            >
              Premium
            </span>
          </div>
        </div>
        {saving && <span className="text-[9px] text-muted-foreground mt-1">Saving…</span>}
      </button>

      <div className="px-[18px] pb-3 -mt-1">
        <span className="text-xs text-muted-foreground">Applies to the whole book, not just this chapter</span>
      </div>

      {expanded && (
        <div className="px-[18px] pb-[22px] pt-1 flex flex-col gap-3">
          {upgradePrompt && (
            <div
              className="rounded-md px-3 py-2 text-[10px]"
              style={{
                color: 'var(--brand)',
                backgroundColor: 'var(--brand-soft)',
                border: '1px solid oklch(0.85 0.18 90 / 0.25)',
              }}
            >
              Publishing details require a premium account.
            </div>
          )}

          {[
            { field: 'subtitle' as const, label: 'Subtitle', type: 'text' },
            { field: 'isbn' as const, label: 'ISBN', type: 'text' },
            { field: 'publisherName' as const, label: 'Publisher name', type: 'text' },
            { field: 'dedication' as const, label: 'Dedication', type: 'text' },
            { field: 'edition' as const, label: 'Edition', type: 'text' },
          ].map(({ field, label, type }) => (
            <div key={field} className="flex flex-col gap-1">
              <label className={pubLabelClass}>{label}</label>
              <input
                type={type}
                defaultValue={fields[field] ?? ''}
                onBlur={e => handleBlur(field, e.target.value)}
                className={pubFieldClass}
                placeholder={`Enter ${label.toLowerCase()}…`}
              />
            </div>
          ))}

          <div className="flex flex-col gap-1">
            <label className={pubLabelClass}>Author bio</label>
            <textarea
              rows={3}
              defaultValue={fields.authorBio ?? ''}
              onBlur={e => handleBlur('authorBio', e.target.value)}
              className={cn(pubFieldClass, "resize-none leading-relaxed")}
              placeholder="Enter author bio…"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className={pubLabelClass}>Trim size</label>
            <select
              defaultValue={fields.trimSize ?? ''}
              onBlur={e => handleBlur('trimSize', e.target.value)}
              className={pubFieldClass}
            >
              <option value="">— Select —</option>
              <option value="5x8">5 × 8</option>
              <option value="5.5x8.5">5.5 × 8.5</option>
              <option value="6x9">6 × 9</option>
            </select>
          </div>
        </div>
      )}
    </div>
  )
}

export function MetadataPanel() {
  const { activeItem, activeItemId, focusMode, corkboardMode, bookId, historyOpen } = useBookEditor()
  const isChapterActive = !!activeItem && CHAPTER_TYPES.has(activeItem.type)

  const hidden = focusMode || corkboardMode || historyOpen

  return (
    <aside
      aria-hidden={hidden}
      className={cn(
        'flex-shrink-0 flex flex-col bg-card border-l border-border overflow-hidden',
        'transition-[width,opacity,transform] duration-200 ease-out',
        hidden
          ? 'w-0 opacity-0 translate-x-2 pointer-events-none'
          : 'w-60 opacity-100 translate-x-0',
      )}
    >
      <div className="flex-1 overflow-y-auto">
        {isChapterActive ? <ChapterMetadata key={activeItemId} /> : <EmptyPlaceholder />}
      </div>
      <PublishingSection bookId={bookId} />
    </aside>
  )
}
