'use client'

import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import type { CharacterCountStorage } from '@tiptap/extensions'
import { cn } from '@/lib/utils'
import { useBookEditor } from '../book-editor-provider'
import { updateChapterWordGoalAction } from '@/lib/actions/chapter.actions'
import { migrateLegacyWordGoal } from '@/lib/word-goal-migration'
import { SprintControls } from './sprint-controls'

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

  const saveLabel =
    saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving…' : 'Unsaved'

  return (
    <div
      data-slot="editor-status-bar"
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        border: 'var(--br-card)',
      }}
      className="flex items-center justify-between gap-4 px-4 py-2 tabular-nums"
    >
      <div data-slot="status-left" className="flex items-center gap-3">
        {/* Save status pill — off-green tint preserved; brand-yellow dot only when unsaved */}
        <div
          style={{ borderRadius: 'var(--r-pill)' }}
          className={cn(
            'inline-flex items-center gap-2 px-3 py-1 text-xs font-mono bg-[oklch(0.85_0.13_165_/_0.20)] text-[oklch(0.85_0.13_165)]',
            saveStatus === 'saving' && 'animate-pulse',
          )}
          title="All edits autosave"
        >
          {saveStatus === 'unsaved' && (
            <span
              style={{ background: 'var(--brand)' }}
              className="w-1.5 h-1.5 rounded-full"
            />
          )}
          <span>{saveLabel}</span>
        </div>

        {/* Word count */}
        <span
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
          className="text-xs font-mono"
        >
          {wordCount.toLocaleString()} words
        </span>

        {/* Word goal */}
        {editing ? (
          <div
            style={{ borderRadius: 'var(--r-pill)', boxShadow: 'var(--sh-inset)' }}
            className="inline-flex items-center gap-2 px-2 py-1 bg-transparent"
          >
            <input
              ref={inputRef}
              type="number"
              min={0}
              max={1_000_000}
              defaultValue={wordGoal}
              style={{ color: 'var(--canvas-dark-ink-strong)' }}
              className="w-16 bg-transparent text-xs font-mono outline-none"
              onKeyDown={e => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') setEditing(false)
              }}
            />
            <button
              onClick={commit}
              style={{ color: 'var(--brand)' }}
              className="text-xs font-mono hover:opacity-80"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
              className="text-xs font-mono hover:opacity-80"
            >
              Cancel
            </button>
          </div>
        ) : wordGoal > 0 ? (
          <button
            onClick={() => setEditing(true)}
            style={{ color: 'var(--brand)' }}
            className="text-xs font-mono hover:opacity-80 underline-offset-2 hover:underline"
            title="Edit word goal"
          >
            {percent}% of {wordGoal.toLocaleString()} word goal
          </button>
        ) : (
          <button
            onClick={() => setEditing(true)}
            style={{ color: 'var(--brand)' }}
            className="text-xs font-mono hover:opacity-80 underline-offset-2 hover:underline"
          >
            Set word goal
          </button>
        )}
      </div>

      <div data-slot="status-right" className="flex items-center gap-2">
        <SprintControls currentWordCount={wordCount} />
      </div>
    </div>
  )
}
