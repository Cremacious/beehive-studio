'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react'
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
  { value: 'IDEA' as const, label: 'Idea', subtitle: 'Not visible to readers', color: 'var(--status-idea)' },
  { value: 'OUTLINE' as const, label: 'Outline', subtitle: 'Not visible to readers', color: 'var(--status-outline)' },
  { value: 'FIRST_DRAFT' as const, label: 'First Draft', subtitle: 'Not visible to readers', color: 'var(--status-first-draft)' },
  { value: 'REVISED' as const, label: 'Revised', subtitle: 'Visible to readers', color: 'var(--status-revised)' },
  { value: 'FINAL' as const, label: 'Final', subtitle: 'Visible to readers', color: 'var(--status-final)' },
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

  const labelClass = "text-sm font-comfortaa font-bold uppercase tracking-wider"
  const labelStyle = { color: 'var(--brand)' } as const
  const fieldClass = "resize-none p-2.5 text-xs outline-none transition-colors leading-relaxed placeholder:italic placeholder:text-muted-foreground"
  const fieldStyle = {
    borderRadius: 'var(--r-row)',
    boxShadow: 'var(--sh-inset)',
    background: 'transparent',
    color: 'var(--canvas-dark-ink-strong)',
  } as const

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
        <span className={labelClass} style={labelStyle}>Status</span>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Set how far along this chapter is. Readers can only see chapters marked{' '}
          <span className="text-foreground/85 font-medium">Revised</span> or{' '}
          <span className="text-foreground/85 font-medium">Final</span> — earlier
          statuses show as a &quot;Draft — coming soon&quot; teaser instead.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map(({ value, label, subtitle, color }) => {
            const isActive = activeChapter?.status === value
            return (
              <button
                key={value}
                onClick={() => updateChapterStatus(value)}
                className="inline-flex flex-col items-center gap-0.5 text-xs px-3 py-1.5 font-geist font-semibold transition-colors"
                style={{
                  borderRadius: 'var(--r-pill)',
                  boxShadow: 'var(--sh-tile)',
                  background: isActive ? color : `oklch(from ${color} l c h / 0.18)`,
                  color: isActive ? 'var(--brand-ink)' : color,
                }}
              >
                <span>{label}</span>
                <span
                  className="text-[9px] font-jetbrains-mono mt-0.5 uppercase tracking-[0.10em]"
                  style={{ color: isActive ? 'var(--brand-ink)' : 'var(--canvas-dark-ink-muted)' }}
                >
                  {subtitle}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="px-[18px] py-[18px] border-b border-[var(--chrome-800)] flex flex-col gap-2.5">
        <span className={labelClass} style={labelStyle}>Synopsis</span>
        <textarea
          key={activeItemId + '-synopsis'}
          className={cn(fieldClass, "min-h-16")}
          style={fieldStyle}
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
            <span className={labelClass} style={labelStyle}>Scene Planner</span>
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
                  <span className={labelClass} style={labelStyle}>{label}</span>
                  <textarea
                    key={activeItemId + '-' + key}
                    className={cn(fieldClass, "min-h-12")}
                    style={fieldStyle}
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
        <span className={labelClass} style={labelStyle}>Notes</span>
        <textarea
          key={activeItemId}
          className={cn(fieldClass, "flex-1 min-h-24 p-3")}
          style={fieldStyle}
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

  const pubLabelClass = "block text-[10px] mb-1 uppercase tracking-[0.10em] font-jetbrains-mono"
  const pubLabelStyle = { color: 'var(--canvas-dark-ink-muted)' } as const
  const pubFieldClass = "w-full bg-transparent px-2.5 py-1.5 text-xs placeholder:text-muted-foreground placeholder:italic focus:outline-none transition-colors"
  const pubFieldStyle = {
    borderRadius: 'var(--r-row)',
    boxShadow: 'var(--sh-inset)',
    color: 'var(--canvas-dark-ink-strong)',
  } as const

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
            <span
              className="text-sm font-comfortaa font-bold uppercase tracking-wider"
              style={{ color: 'var(--brand)' }}
            >
              Publishing details
            </span>
            <span
              className="px-2 py-0.5 text-[10px] font-geist font-bold uppercase tracking-wide inline-flex items-center gap-1"
              style={{
                background: 'var(--brand)',
                color: 'var(--brand-ink)',
                borderRadius: 'var(--r-pill)',
              }}
            >
              <Sparkles className="w-3 h-3" />
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
              <label className={pubLabelClass} style={pubLabelStyle}>{label}</label>
              <input
                type={type}
                defaultValue={fields[field] ?? ''}
                onBlur={e => handleBlur(field, e.target.value)}
                className={pubFieldClass}
                style={pubFieldStyle}
                placeholder={`Enter ${label.toLowerCase()}…`}
              />
            </div>
          ))}

          <div className="flex flex-col gap-1">
            <label className={pubLabelClass} style={pubLabelStyle}>Author bio</label>
            <textarea
              rows={3}
              defaultValue={fields.authorBio ?? ''}
              onBlur={e => handleBlur('authorBio', e.target.value)}
              className={cn(pubFieldClass, "resize-none leading-relaxed")}
              style={pubFieldStyle}
              placeholder="Enter author bio…"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className={pubLabelClass} style={pubLabelStyle}>Trim size</label>
            <select
              defaultValue={fields.trimSize ?? ''}
              onBlur={e => handleBlur('trimSize', e.target.value)}
              className={pubFieldClass}
              style={pubFieldStyle}
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
  const { activeItem, activeItemId, focusMode, bookId, historyOpen } = useBookEditor()
  const isChapterActive = !!activeItem && CHAPTER_TYPES.has(activeItem.type)

  const hidden = focusMode || historyOpen

  return (
    <aside
      aria-hidden={hidden}
      style={
        hidden
          ? undefined
          : {
              background:
                'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
              borderRadius: 'var(--r-card)',
              boxShadow: 'var(--sh-card)',
              border: 'var(--br-card)',
            }
      }
      className={cn(
        'flex-shrink-0 flex flex-col overflow-hidden',
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
