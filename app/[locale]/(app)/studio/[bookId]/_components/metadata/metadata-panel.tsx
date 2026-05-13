'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useBookEditor } from '../book-editor-provider'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import {
  getPublishingMetadataAction,
  updatePublishingMetadataAction,
  type PublishingMetadata,
} from '@/lib/actions/publishing.actions'

const CHAPTER_TYPES = new Set(['chapter', 'front_matter', 'back_matter'])

const STATUS_OPTIONS = [
  { value: 'IDEA' as const, label: 'Idea' },
  { value: 'OUTLINE' as const, label: 'Outline' },
  { value: 'FIRST_DRAFT' as const, label: 'First Draft' },
  { value: 'REVISED' as const, label: 'Revised' },
  { value: 'FINAL' as const, label: 'Final' },
]

type ChapterMeta = {
  synopsis?: string
  sceneGoal?: string
  sceneConflict?: string
  sceneOutcome?: string
}

function EmptyPlaceholder() {
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <p className="text-xs text-muted-foreground text-center">Select a chapter to see details.</p>
    </div>
  )
}

function ChapterMetadata() {
  const { activeItem, activeItemId, activeChapter, wordCount, updateChapterStatus, updateChapterNotes, updateBinderItem } = useBookEditor()
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [scenePlannerOpen, setScenePlannerOpen] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const metaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [wordGoal, setWordGoalState] = useState(() => {
    if (typeof window === 'undefined') return 0
    return parseInt(localStorage.getItem(`wcg:${activeItem!.id}`) ?? '0', 10)
  })

  function setWordGoal(val: number) {
    setWordGoalState(val)
    localStorage.setItem(`wcg:${activeItem!.id}`, String(val))
  }

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

  return (
    <div className="p-4 flex flex-col gap-5">
      {isEditingTitle ? (
        <input
          ref={titleInputRef}
          defaultValue={activeItem!.title}
          className="text-sm font-medium text-foreground bg-transparent border-b border-brand outline-none w-full"
          onKeyDown={e => {
            if (e.key === 'Enter') commitTitle()
            if (e.key === 'Escape') setIsEditingTitle(false)
          }}
          onBlur={commitTitle}
        />
      ) : (
        <h2
          className="text-sm font-medium text-foreground cursor-pointer hover:text-brand transition-colors"
          onClick={() => setIsEditingTitle(true)}
        >
          {activeItem!.title}
        </h2>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Status</span>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => updateChapterStatus(value)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition-colors",
                activeChapter?.status === value
                  ? "bg-brand/20 border-brand/40 text-brand"
                  : "border-border text-muted-foreground hover:border-brand/40 hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Synopsis</span>
        <textarea
          key={activeItemId + '-synopsis'}
          className="resize-none bg-surface-inset rounded-md p-2 text-xs text-foreground/80 outline-none border border-border focus:border-brand/40 transition-colors leading-relaxed min-h-16"
          placeholder="One-line chapter summary…"
          defaultValue={meta.synopsis ?? ''}
          onChange={e => handleMetaChange({ synopsis: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <button
          onClick={() => setScenePlannerOpen(o => !o)}
          className="flex items-center justify-between text-xs text-muted-foreground uppercase tracking-wide font-medium hover:text-foreground transition-colors"
        >
          <span>Scene Planner</span>
          <span>{scenePlannerOpen ? '▾' : '▸'}</span>
        </button>
        {scenePlannerOpen && (
          <div className="flex flex-col gap-2">
            {[
              { key: 'sceneGoal', label: 'Goal', placeholder: "What does the POV character want?" },
              { key: 'sceneConflict', label: 'Conflict', placeholder: "What stands in their way?" },
              { key: 'sceneOutcome', label: 'Outcome', placeholder: "How does the scene end?" },
            ].map(({ key, label, placeholder }) => (
              <div key={key} className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                <textarea
                  key={activeItemId + '-' + key}
                  className="resize-none bg-surface-inset rounded-md p-2 text-xs text-foreground/80 outline-none border border-border focus:border-brand/40 transition-colors leading-relaxed min-h-12"
                  placeholder={placeholder}
                  defaultValue={(meta as Record<string, string>)[key] ?? ''}
                  onChange={e => handleMetaChange({ [key]: e.target.value } as Partial<ChapterMeta>)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {wordCount > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Words</span>
          <span className="text-sm text-foreground">{wordCount.toLocaleString()}</span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Word Goal</span>
          {wordGoal > 0 && (
            <span className="text-xs text-muted-foreground">{Math.round((wordCount / wordGoal) * 100)}%</span>
          )}
        </div>
        {wordGoal > 0 && (
          <div className="h-1.5 bg-surface rounded-full">
            <div
              className="h-full bg-brand rounded-full transition-all"
              style={{ width: `${Math.min(100, (wordCount / wordGoal) * 100)}%` }}
            />
          </div>
        )}
        <input
          type="number"
          value={wordGoal || ''}
          onChange={e => setWordGoal(parseInt(e.target.value) || 0)}
          placeholder="Set word goal…"
          className="bg-surface-inset border border-border rounded px-2 py-1 text-xs outline-none focus:border-brand/40 text-foreground w-full"
          min={0}
        />
      </div>

      <div className="flex flex-col gap-1.5 flex-1">
        <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Notes</span>
        <textarea
          key={activeItemId}
          className="flex-1 resize-none bg-surface-inset rounded-md p-3 text-xs text-foreground/80 outline-none border border-border focus:border-brand/40 transition-colors leading-relaxed min-h-24"
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

  return (
    <div className="border-t border-[#2a2a2a] mt-2">
      <button
        onClick={handleExpand}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[#1a1a1a] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#666]">
            {expanded ? '▾' : '▸'} Publishing details
          </span>
          <span className="rounded-sm bg-[#1f1a00] px-1.5 py-0.5 text-[9px] font-semibold text-[#FFC300] border border-[#3a2e00]">
            Premium
          </span>
        </div>
        {saving && <span className="text-[9px] text-[#555]">Saving…</span>}
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {upgradePrompt && (
            <div className="rounded-md border border-[#3a2e00] bg-[#1a1200] px-3 py-2 text-[10px] text-[#FFC300]">
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
            <div key={field}>
              <label className="block text-[10px] text-[#555] mb-1">{label}</label>
              <input
                type={type}
                defaultValue={fields[field] ?? ''}
                onBlur={e => handleBlur(field, e.target.value)}
                className="w-full rounded border border-[#2a2a2a] bg-[#111] px-2 py-1.5 text-xs text-[#ccc] placeholder-[#444] focus:border-[#3a3a3a] focus:outline-none"
                placeholder={`Enter ${label.toLowerCase()}…`}
              />
            </div>
          ))}

          <div>
            <label className="block text-[10px] text-[#555] mb-1">Author bio</label>
            <textarea
              rows={3}
              defaultValue={fields.authorBio ?? ''}
              onBlur={e => handleBlur('authorBio', e.target.value)}
              className="w-full rounded border border-[#2a2a2a] bg-[#111] px-2 py-1.5 text-xs text-[#ccc] placeholder-[#444] focus:border-[#3a3a3a] focus:outline-none resize-none"
              placeholder="Enter author bio…"
            />
          </div>

          <div>
            <label className="block text-[10px] text-[#555] mb-1">Trim size</label>
            <select
              defaultValue={fields.trimSize ?? ''}
              onBlur={e => handleBlur('trimSize', e.target.value)}
              className="w-full rounded border border-[#2a2a2a] bg-[#111] px-2 py-1.5 text-xs text-[#ccc] focus:border-[#3a3a3a] focus:outline-none"
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
  const { activeItem, activeItemId, focusMode, corkboardMode, bookId } = useBookEditor()
  const isChapterActive = !!activeItem && CHAPTER_TYPES.has(activeItem.type)

  if (focusMode || corkboardMode) return null

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col bg-card border-l border-border overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {isChapterActive ? <ChapterMetadata key={activeItemId} /> : <EmptyPlaceholder />}
      </div>
      <PublishingSection bookId={bookId} />
    </aside>
  )
}
