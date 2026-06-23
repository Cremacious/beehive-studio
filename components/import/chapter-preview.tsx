'use client'

import type { ImportPreview } from '@/lib/import/types'
import type { SplitMode } from './use-document-import'

type Props = {
  preview: ImportPreview
  splitMode: SplitMode
  onSplitModeChange: (m: SplitMode) => void
}

const TILE_BG = 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))'

/**
 * Shared preview of detected chapters (titles + word counts) plus the
 * split-vs-single toggle. Used by the wizard import panel and the append modal.
 */
export function ChapterPreview({ preview, splitMode, onSplitModeChange }: Props) {
  const n = preview.chapters.length
  const totalWords = preview.chapters.reduce((sum, c) => sum + c.wordCount, 0)
  const showToggle = n > 1

  return (
    <div>
      {showToggle && (
        <>
          <div
            className="font-mono uppercase mb-3"
            style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--canvas-dark-ink-muted)' }}
          >
            How to import
          </div>
          <div
            role="radiogroup"
            aria-label="Import structure"
            className="flex gap-1 p-1 mb-4"
            style={{ background: 'var(--canvas-dark-100)', borderRadius: 'var(--r-btn)', boxShadow: 'var(--sh-tile)' }}
          >
            {([
              { mode: 'split' as const, label: `Split into ${n} chapters` },
              { mode: 'single' as const, label: 'Single chapter' },
            ]).map(({ mode, label }) => {
              const isActive = splitMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => onSplitModeChange(mode)}
                  className="flex-1 transition-colors"
                  style={{
                    padding: '9px 0',
                    borderRadius: 9,
                    fontFamily: 'var(--font-display)',
                    fontSize: 13,
                    fontWeight: 700,
                    background: isActive ? 'var(--brand-soft)' : 'transparent',
                    boxShadow: isActive ? '0 0 0 1px oklch(0.85 0.18 90 / 0.3)' : 'none',
                    color: isActive ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </>
      )}

      <div
        className="flex items-center justify-between mb-2"
        style={{ fontSize: 12, color: 'var(--canvas-dark-ink-muted)' }}
      >
        <span>
          {splitMode === 'single' ? '1 chapter' : `${n} ${n === 1 ? 'chapter' : 'chapters'}`} detected
        </span>
        <span>{totalWords.toLocaleString()} words</span>
      </div>

      {splitMode === 'split' && (
        <ul
          className="flex flex-col gap-1.5 overflow-y-auto"
          style={{ maxHeight: 260, listStyle: 'none', margin: 0, padding: 0 }}
        >
          {preview.chapters.map((ch, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3"
              style={{ padding: '10px 12px', borderRadius: 'var(--r-row)', background: TILE_BG, boxShadow: 'var(--sh-tile)' }}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span
                  className="inline-flex flex-none items-center justify-center font-mono"
                  style={{ width: 22, height: 22, borderRadius: 6, fontSize: 10, background: 'var(--canvas-dark-100)', color: 'var(--canvas-dark-ink-muted)' }}
                >
                  {i + 1}
                </span>
                <span
                  className="truncate"
                  style={{ fontSize: 13, color: 'var(--canvas-dark-ink)', fontWeight: 500 }}
                >
                  {ch.title}
                </span>
              </span>
              <span className="flex-none font-mono" style={{ fontSize: 11, color: 'var(--canvas-dark-ink-muted)' }}>
                {ch.wordCount.toLocaleString()} words
              </span>
            </li>
          ))}
        </ul>
      )}

      {splitMode === 'single' && (
        <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--canvas-dark-ink-muted)' }}>
          All detected sections will be merged into one chapter. You can split it up later in the editor.
        </p>
      )}
    </div>
  )
}
