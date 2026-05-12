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
  const titleInputRef = useRef<HTMLInputElement>(null)

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

      {wordCount > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Words</span>
          <span className="text-sm text-foreground">{wordCount.toLocaleString()}</span>
        </div>
      )}

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
  const { activeItem } = useBookEditor()
  const isChapterActive = !!activeItem && CHAPTER_TYPES.has(activeItem.type)

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col bg-card border-l border-border overflow-hidden">
      {isChapterActive ? <ChapterMetadata /> : <EmptyPlaceholder />}
    </aside>
  )
}
