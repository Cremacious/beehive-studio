'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBookEditor } from '../book-editor-provider'
import { EmptyState } from '../empty-state'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'

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


export function MetadataPanel() {
  const { activeItem, activeItemId, focusMode, historyOpen } = useBookEditor()
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
    </aside>
  )
}
