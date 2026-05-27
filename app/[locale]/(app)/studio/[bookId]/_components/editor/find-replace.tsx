'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Editor } from '@tiptap/react'
import { ChevronUp, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  editor: Editor
  onClose: () => void
}

function findMatches(editor: Editor, query: string, matchCase: boolean): number[] {
  if (!query) return []
  const positions: number[] = []
  const doc = editor.state.doc
  const searchStr = matchCase ? query : query.toLowerCase()

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const text = matchCase ? node.text : node.text.toLowerCase()
    let idx = text.indexOf(searchStr)
    while (idx !== -1) {
      positions.push(pos + idx)
      idx = text.indexOf(searchStr, idx + 1)
    }
  })
  return positions
}

export function FindReplace({ editor, onClose }: Props) {
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [matches, setMatches] = useState<number[]>([])
  const [currentMatch, setCurrentMatch] = useState(0)
  const [showReplace, setShowReplace] = useState(false)

  const goToMatch = useCallback(
    (index: number, matchList = matches, query = findText) => {
      if (matchList.length === 0) return
      const from = matchList[index]
      editor.commands.setTextSelection({ from, to: from + query.length })
      editor.commands.scrollIntoView()
      setCurrentMatch(index)
    },
    [editor, matches, findText],
  )

  useEffect(() => {
    const newMatches = findMatches(editor, findText, matchCase)
    setMatches(newMatches)
    setCurrentMatch(0)
    if (newMatches.length > 0) {
      const from = newMatches[0]
      editor.commands.setTextSelection({ from, to: from + findText.length })
      editor.commands.scrollIntoView()
    }
  }, [findText, matchCase, editor])

  function findNext() {
    if (matches.length === 0) return
    const next = (currentMatch + 1) % matches.length
    goToMatch(next)
  }

  function findPrev() {
    if (matches.length === 0) return
    const prev = (currentMatch - 1 + matches.length) % matches.length
    goToMatch(prev)
  }

  function replaceCurrent() {
    if (matches.length === 0) return
    const from = matches[currentMatch]
    const to = from + findText.length
    editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, replaceText).run()
    const newMatches = findMatches(editor, findText, matchCase)
    setMatches(newMatches)
    const next = Math.max(0, Math.min(currentMatch, newMatches.length - 1))
    setCurrentMatch(next)
    if (newMatches.length > 0) {
      const f = newMatches[next]
      editor.commands.setTextSelection({ from: f, to: f + findText.length })
      editor.commands.scrollIntoView()
    }
  }

  function replaceAll() {
    if (matches.length === 0) return
    const sorted = [...matches].sort((a, b) => b - a)
    editor.chain().focus().run()
    for (const from of sorted) {
      editor.chain().deleteRange({ from, to: from + findText.length }).insertContentAt(from, replaceText).run()
    }
    setMatches([])
    setCurrentMatch(0)
  }

  const noMatches = findText.length > 0 && matches.length === 0
  const countText = findText
    ? matches.length === 0
      ? 'No matches'
      : `${currentMatch + 1} / ${matches.length}`
    : ''

  return (
    <div
      data-slot="find-replace"
      className="flex justify-center px-4 pt-2"
    >
      {/* Theme-aware bridge for find/replace — paper context for light mode */}
      <style>{`
        [data-slot="find-replace"] {
          --fr-bg: var(--chrome-900);
          --fr-border: var(--chrome-800);
          --fr-input-bg: var(--chrome-950);
          --fr-input-border: var(--chrome-800);
          --fr-ink: var(--chrome-100);
          --fr-ink-muted: var(--chrome-400);
          --fr-btn-hover-bg: var(--chrome-800);
          --fr-sep: var(--chrome-800);
        }
        [data-editor-theme="light"] [data-slot="find-replace"] {
          --fr-bg: var(--paper-100);
          --fr-border: var(--paper-300);
          --fr-input-bg: var(--paper-50);
          --fr-input-border: var(--paper-300);
          --fr-ink: var(--paper-ink-strong);
          --fr-ink-muted: var(--paper-ink-muted);
          --fr-btn-hover-bg: oklch(0.78 0.04 60 / 0.18);
          --fr-sep: var(--paper-300);
        }
        [data-slot="find-replace"] .fr-ibtn:hover { background: var(--fr-btn-hover-bg); color: var(--fr-ink); }
        [data-slot="find-replace"] .fr-ibtn:disabled { opacity: 0.4; cursor: not-allowed; }
        [data-slot="find-replace"] .fr-ibtn.active {
          background: var(--brand-soft);
          color: var(--color-brand);
        }
        [data-slot="find-replace"] .fr-input:focus {
          border-color: var(--color-brand);
          box-shadow: 0 0 0 3px var(--brand-soft);
        }
      `}</style>

      <div
        className="w-full max-w-[560px] rounded-lg shadow-lg"
        style={{
          background: 'var(--fr-bg)',
          border: '1px solid var(--fr-border)',
        }}
      >
        {/* Row 1: search */}
        <div className="flex items-center gap-1.5 px-2 py-2">
          <input
            autoFocus
            value={findText}
            onChange={e => setFindText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.shiftKey ? findPrev() : findNext()
              }
              if (e.key === 'Escape') onClose()
            }}
            placeholder="Find…"
            className="fr-input flex-1 h-7 rounded px-2.5 text-sm outline-none transition-shadow"
            style={{
              background: 'var(--fr-input-bg)',
              border: '1px solid var(--fr-input-border)',
              color: 'var(--fr-ink)',
            }}
          />
          <span
            className="text-[11px] font-mono whitespace-nowrap px-1.5"
            style={{ color: noMatches ? 'var(--destructive)' : 'var(--fr-ink-muted)' }}
          >
            {countText}
          </span>
          <button
            onClick={findPrev}
            disabled={matches.length === 0}
            title="Previous match (Shift+Enter)"
            className="fr-ibtn inline-flex items-center justify-center w-7 h-7 rounded transition-colors"
            style={{ color: 'var(--fr-ink-muted)' }}
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={findNext}
            disabled={matches.length === 0}
            title="Next match (Enter)"
            className="fr-ibtn inline-flex items-center justify-center w-7 h-7 rounded transition-colors"
            style={{ color: 'var(--fr-ink-muted)' }}
          >
            <ChevronDown size={14} />
          </button>
          <span className="w-px h-4 mx-0.5" style={{ background: 'var(--fr-sep)' }} />
          <button
            onClick={() => setMatchCase(c => !c)}
            title="Match case"
            className={cn(
              'fr-ibtn inline-flex items-center justify-center w-7 h-7 rounded font-bold text-[11px] transition-colors',
              matchCase && 'active',
            )}
            style={!matchCase ? { color: 'var(--fr-ink-muted)' } : undefined}
          >
            Aa
          </button>
          <button
            onClick={() => setShowReplace(r => !r)}
            title="Toggle replace"
            className={cn(
              'fr-ibtn inline-flex items-center justify-center px-2 h-7 rounded text-[11px] font-semibold transition-colors',
              showReplace && 'active',
            )}
            style={!showReplace ? { color: 'var(--fr-ink-muted)' } : undefined}
          >
            Replace
          </button>
          <span className="w-px h-4 mx-0.5" style={{ background: 'var(--fr-sep)' }} />
          <button
            onClick={onClose}
            aria-label="Close find"
            className="fr-ibtn inline-flex items-center justify-center w-7 h-7 rounded transition-colors"
            style={{ color: 'var(--fr-ink-muted)' }}
          >
            <X size={14} />
          </button>
        </div>

        {showReplace && (
          <div
            className="flex items-center gap-1.5 px-2 pb-2 -mt-0.5"
            style={{ borderTop: '1px dashed var(--fr-sep)', paddingTop: '8px' }}
          >
            <input
              value={replaceText}
              onChange={e => setReplaceText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') replaceCurrent()
                if (e.key === 'Escape') onClose()
              }}
              placeholder="Replace with…"
              className="fr-input flex-1 h-7 rounded px-2.5 text-sm outline-none transition-shadow"
              style={{
                background: 'var(--fr-input-bg)',
                border: '1px solid var(--fr-input-border)',
                color: 'var(--fr-ink)',
              }}
            />
            <button
              onClick={replaceCurrent}
              disabled={matches.length === 0}
              className="fr-ibtn inline-flex items-center justify-center px-2.5 h-7 rounded text-[11px] font-semibold transition-colors"
              style={{ color: 'var(--fr-ink-muted)' }}
            >
              Replace
            </button>
            <button
              onClick={replaceAll}
              disabled={matches.length === 0}
              className="inline-flex items-center justify-center px-2.5 h-7 rounded text-[11px] font-semibold transition-colors hover:bg-brand-hover disabled:opacity-40"
              style={{
                background: 'var(--color-brand)',
                color: 'var(--brand-ink)',
              }}
            >
              Replace all
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
