'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useBookEditor } from '../book-editor-provider'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'

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

export function MetadataPanel() {
  const { activeItem, activeItemId, focusMode } = useBookEditor()
  const isChapterActive = !!activeItem && CHAPTER_TYPES.has(activeItem.type)

  if (focusMode) return null

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col bg-card border-l border-border overflow-hidden">
      {isChapterActive ? <ChapterMetadata key={activeItemId} /> : <EmptyPlaceholder />}
    </aside>
  )
}
