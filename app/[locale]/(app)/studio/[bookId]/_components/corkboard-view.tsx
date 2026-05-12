'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useBookEditor } from './book-editor-provider'

type ChapterMeta = {
  synopsis?: string
}

const CHAPTER_TYPES = new Set(['chapter', 'front_matter', 'back_matter'])

export function CorkboardView() {
  const { binderItems, setActiveItemId, toggleCorkboardMode } = useBookEditor()

  const chapters = useMemo(() =>
    binderItems
      .filter(item => CHAPTER_TYPES.has(item.type))
      .sort((a, b) => a.order - b.order),
    [binderItems]
  )

  function openChapter(id: string) {
    setActiveItemId(id)
    toggleCorkboardMode()
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-bold text-foreground/70 uppercase tracking-wide">Corkboard</h2>
        <button
          onClick={toggleCorkboardMode}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕ Exit
        </button>
      </div>

      {chapters.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center mt-20">No chapters yet. Add one from the binder.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {chapters.map(item => {
            const meta: ChapterMeta = (item.content && typeof item.content === 'object' && !Array.isArray(item.content))
              ? item.content as ChapterMeta
              : {}

            return (
              <button
                key={item.id}
                onClick={() => openChapter(item.id)}
                className={cn(
                  "flex flex-col text-left p-4 rounded-xl border bg-surface hover:border-brand/40 hover:bg-surface-elevated transition-all group",
                  "border-border",
                )}
              >
                {/* Type label */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground">
                    {item.type === 'front_matter' ? 'Front' : item.type === 'back_matter' ? 'Back' : 'Chapter'}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-sm font-medium text-foreground group-hover:text-brand transition-colors line-clamp-2 mb-2">
                  {item.title}
                </h3>

                {/* Synopsis */}
                {meta.synopsis ? (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4 flex-1">
                    {meta.synopsis}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/40 italic flex-1">No synopsis</p>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
