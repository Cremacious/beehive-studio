'use client'

import { useBookEditor } from '../book-editor-provider'

type Props = {
  onPick: (chapterId: string) => void
  onClose: () => void
}

export function ChapterLinkPopover({ onPick, onClose }: Props) {
  const { binderItems } = useBookEditor()
  const chapters = binderItems
    .filter(b => b.type === 'chapter' && b.chapterId)
    .sort((a, b) => a.order - b.order)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-surface-elevated border border-border rounded-lg shadow-2xl p-3 max-w-md w-full max-h-[60vh] flex flex-col gap-2"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Link to chapter</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {chapters.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2">
            No chapters in this book yet. Add a chapter from the binder first.
          </p>
        ) : (
          <div className="overflow-y-auto flex flex-col gap-1">
            {chapters.map(c => (
              <button
                key={c.id}
                onClick={() => { onPick(c.chapterId!); onClose() }}
                className="text-left text-xs px-3 py-2 rounded hover:bg-surface text-foreground/80 hover:text-foreground"
              >
                {c.title || 'Untitled chapter'}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
