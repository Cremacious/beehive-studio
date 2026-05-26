'use client'

import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import type { CharacterCountStorage } from '@tiptap/extensions'
import { cn } from '@/lib/utils'
import { useBookEditor } from '../book-editor-provider'
import { updateChapterWordGoalAction } from '@/lib/actions/chapter.actions'
import { migrateLegacyWordGoal } from '@/lib/word-goal-migration'

type Props = { editor: Editor }

export function EditorStatusBar({ editor }: Props) {
  const { saveStatus, activeChapter, activeItem } = useBookEditor()
  const [wordGoal, setWordGoal] = useState<number>(activeChapter?.wordGoal ?? 0)
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync local state when the active chapter changes
  useEffect(() => {
    setWordGoal(activeChapter?.wordGoal ?? 0)
  }, [activeChapter?.id, activeChapter?.wordGoal])

  // Lazy localStorage→DB migration. Runs once per chapter per device.
  useEffect(() => {
    if (!activeChapter || !activeItem) return
    const migrated = migrateLegacyWordGoal(activeItem.id, activeChapter.wordGoal)
    if (migrated !== null) {
      setWordGoal(migrated)
      void updateChapterWordGoalAction(activeChapter.id, migrated)
    }
  }, [activeChapter, activeItem])

  // Focus the input when entering edit mode
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const charCount = editor.storage.characterCount as CharacterCountStorage | undefined
  const wordCount = charCount?.words() ?? 0
  const percent = wordGoal > 0 ? Math.min(100, Math.round((wordCount / wordGoal) * 100)) : 0

  async function commit() {
    if (!activeChapter) return
    const raw = inputRef.current?.value ?? '0'
    const next = Math.max(0, Math.min(1_000_000, parseInt(raw, 10) || 0))
    setEditing(false)
    if (next === wordGoal) return
    const previous = wordGoal
    setWordGoal(next) // optimistic
    const result = await updateChapterWordGoalAction(activeChapter.id, next)
    if (!result.success) {
      // Revert on failure
      setWordGoal(previous)
    }
  }

  return (
    <div
      data-slot="editor-status-bar"
      className="flex items-center justify-between gap-3 px-4 py-1.5 border-t border-border bg-surface text-xs text-foreground/60 tabular-nums"
    >
      <div className="flex items-center gap-3">
        {/* Save status */}
        <span
          className={cn(
            'inline-flex items-center gap-1',
            saveStatus === 'unsaved' && 'text-brand',
            saveStatus === 'saving' && 'text-foreground/40 animate-pulse',
          )}
          title="All edits autosave"
        >
          {saveStatus === 'saved' && '● Saved'}
          {saveStatus === 'saving' && '○ Saving…'}
          {saveStatus === 'unsaved' && '● Unsaved'}
        </span>

        <span className="text-foreground/30">·</span>

        {/* Word count */}
        <span>{wordCount.toLocaleString()} words</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Word goal */}
        {editing ? (
          <>
            <input
              ref={inputRef}
              type="number"
              min={0}
              max={1_000_000}
              defaultValue={wordGoal}
              className="w-20 bg-surface-inset border border-border rounded px-2 py-0.5 text-xs text-foreground outline-none focus:border-brand/40"
              onKeyDown={e => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') setEditing(false)
              }}
            />
            <button
              onClick={commit}
              className="text-xs text-brand hover:text-brand-hover"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </>
        ) : wordGoal > 0 ? (
          <>
            <span>{percent}% of {wordGoal.toLocaleString()} word goal</span>
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              edit
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            Set word goal
          </button>
        )}
      </div>
    </div>
  )
}
