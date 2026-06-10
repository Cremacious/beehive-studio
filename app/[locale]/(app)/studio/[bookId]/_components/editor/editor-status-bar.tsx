'use client'

import { useEffect, useRef, useState } from 'react'
import { Pencil, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBookEditor } from '../book-editor-provider'
import { updateChapterWordGoalAction } from '@/lib/actions/chapter.actions'
import { migrateLegacyWordGoal } from '@/lib/word-goal-migration'
import { SprintControls } from './sprint-controls'

export function EditorStatusBar() {
  const { saveStatus, activeChapter, activeItem, wordCount } = useBookEditor()
  const [wordGoal, setWordGoal] = useState<number>(activeChapter?.wordGoal ?? 0)
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setWordGoal(activeChapter?.wordGoal ?? 0)
  }, [activeChapter?.id, activeChapter?.wordGoal])

  useEffect(() => {
    if (!activeChapter || !activeItem) return
    const migrated = migrateLegacyWordGoal(activeItem.id, activeChapter.wordGoal)
    if (migrated !== null) {
      setWordGoal(migrated)
      void updateChapterWordGoalAction(activeChapter.id, migrated)
    }
  }, [activeChapter, activeItem])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const hasChapter = activeChapter !== null
  const percent = wordGoal > 0 ? Math.min(100, Math.round((wordCount / wordGoal) * 100)) : 0

  async function commit() {
    if (!activeChapter) return
    const raw = inputRef.current?.value ?? '0'
    const next = Math.max(0, Math.min(1_000_000, parseInt(raw, 10) || 0))
    setEditing(false)
    if (next === wordGoal) return
    const previous = wordGoal
    setWordGoal(next)
    const result = await updateChapterWordGoalAction(activeChapter.id, next)
    if (!result.success) setWordGoal(previous)
  }

  async function clearGoal() {
    if (!activeChapter || wordGoal === 0) return
    const previous = wordGoal
    setWordGoal(0)
    setEditing(false)
    const result = await updateChapterWordGoalAction(activeChapter.id, 0)
    if (!result.success) setWordGoal(previous)
  }

  const saveDotColor =
    saveStatus === 'saved'
      ? 'oklch(0.78 0.15 145)'
      : saveStatus === 'saving'
        ? 'var(--canvas-dark-ink-muted)'
        : 'var(--brand)'
  const saveLabel =
    saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving…' : 'Unsaved'

  const labelClass = 'text-[9px] font-mono uppercase tracking-[0.10em] font-semibold'
  const labelStyle = { color: 'var(--canvas-dark-ink-strong)' } as const

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
      className="flex flex-col tabular-nums"
    >
      {/* Row 1: save status + word count */}
      <div className="flex items-center justify-between px-3.5 py-2.5">
        <div className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn('w-1.5 h-1.5 rounded-full', saveStatus === 'saving' && 'animate-pulse')}
            style={{ background: saveDotColor }}
          />
          <span
            className="text-[11px] font-mono"
            style={{ color: 'var(--canvas-dark-ink)' }}
          >
            {saveLabel}
          </span>
        </div>
        <div className="inline-flex items-baseline gap-1">
          <span
            className="text-[13px] font-mono font-semibold"
            style={{ color: 'var(--canvas-dark-ink-strong)' }}
          >
            {wordCount.toLocaleString()}
          </span>
          <span className={labelClass} style={labelStyle}>
            words
          </span>
        </div>
      </div>

      {/* Row 2: word goal */}
      <div
        className="px-3.5 py-2.5 flex flex-col gap-1.5"
        style={{ borderTop: 'var(--br-card)' }}
      >
        <span className={labelClass} style={labelStyle}>
          Word goal
        </span>
        {!hasChapter ? (
          <span
            className="text-[11px] font-mono italic"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            No chapter selected
          </span>
        ) : editing ? (
          <div className="inline-flex items-center gap-2 flex-wrap">
            <input
              ref={inputRef}
              type="number"
              min={0}
              max={1_000_000}
              defaultValue={wordGoal}
              placeholder="Words"
              style={{
                color: 'var(--canvas-dark-ink-strong)',
                background: 'var(--canvas-dark-100)',
                boxShadow: 'var(--sh-inset)',
                borderRadius: 'var(--r-row)',
              }}
              className="w-20 px-2 py-1 text-xs font-mono outline-none"
              onKeyDown={e => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') setEditing(false)
              }}
            />
            <button
              onClick={commit}
              style={{ color: 'var(--brand)' }}
              className="text-[11px] font-mono hover:opacity-80"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
              className="text-[11px] font-mono hover:opacity-80"
            >
              Cancel
            </button>
            {wordGoal > 0 && (
              <button
                onClick={clearGoal}
                style={{ color: 'oklch(0.72 0.2 25)' }}
                className="text-[11px] font-mono hover:opacity-80"
                title="Remove word goal"
              >
                Remove
              </button>
            )}
          </div>
        ) : wordGoal > 0 ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-[12px] font-mono"
                style={{ color: 'var(--canvas-dark-ink-strong)' }}
              >
                <span style={{ color: 'var(--brand)' }}>{percent}%</span>{' '}
                <span style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                  of {wordGoal.toLocaleString()}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-md hover:bg-[var(--canvas-dark-300)] transition-colors"
                  style={{ color: 'var(--canvas-dark-ink-muted)' }}
                  title="Change word goal"
                  aria-label="Change word goal"
                >
                  <Pencil size={12} />
                </button>
                <button
                  type="button"
                  onClick={clearGoal}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-md hover:bg-[var(--canvas-dark-300)] transition-colors"
                  style={{ color: 'var(--canvas-dark-ink-muted)' }}
                  title="Remove word goal"
                  aria-label="Remove word goal"
                >
                  <X size={12} />
                </button>
              </span>
            </div>
            {/* Progress track */}
            <div
              className="h-1 rounded-full overflow-hidden"
              style={{ background: 'var(--canvas-dark-100)', boxShadow: 'var(--sh-inset)' }}
              aria-hidden
            >
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${percent}%`, background: 'var(--brand)' }}
              />
            </div>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-left text-[11px] font-mono hover:opacity-80 self-start"
            style={{ color: 'var(--brand)' }}
          >
            Set a goal →
          </button>
        )}
      </div>

      {/* Row 3: sprint controls */}
      <div
        className="px-3.5 py-2.5 flex flex-col gap-1.5"
        style={{ borderTop: 'var(--br-card)' }}
      >
        <span className={labelClass} style={labelStyle}>
          Sprint
        </span>
        <SprintControls currentWordCount={wordCount} />
      </div>
    </div>
  )
}
