'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Editor } from '@tiptap/react'
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

  return (
    <div className="absolute top-2 right-2 z-20 bg-surface-elevated border border-border rounded-xl shadow-xl p-3 w-72">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-foreground/70">Find &amp; Replace</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm leading-none">
          ×
        </button>
      </div>

      {/* Find row */}
      <div className="flex gap-1.5 mb-1.5">
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
          className="flex-1 bg-surface border border-border rounded px-2 py-1 text-xs outline-none focus:border-brand/40 text-foreground"
        />
        <button
          onClick={() => setMatchCase(c => !c)}
          title="Match case"
          className={cn(
            'text-xs px-2 py-1 rounded border',
            matchCase ? 'border-brand text-brand bg-brand/10' : 'border-border text-muted-foreground hover:border-brand/40',
          )}
        >
          Aa
        </button>
      </div>

      {/* Match count */}
      <div className="text-xs text-muted-foreground mb-2">
        {findText && (matches.length === 0 ? 'No matches' : `${currentMatch + 1} of ${matches.length}`)}
      </div>

      {/* Find navigation */}
      <div className="flex gap-1.5 mb-2">
        <button
          onClick={findPrev}
          disabled={matches.length === 0}
          className="flex-1 text-xs py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-brand/40 disabled:opacity-40"
        >
          ↑ Prev
        </button>
        <button
          onClick={findNext}
          disabled={matches.length === 0}
          className="flex-1 text-xs py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-brand/40 disabled:opacity-40"
        >
          ↓ Next
        </button>
      </div>

      {/* Toggle replace */}
      <button
        onClick={() => setShowReplace(r => !r)}
        className="text-xs text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1"
      >
        {showReplace ? '▾' : '▸'} Replace
      </button>

      {showReplace && (
        <>
          <input
            value={replaceText}
            onChange={e => setReplaceText(e.target.value)}
            placeholder="Replace with…"
            className="w-full bg-surface border border-border rounded px-2 py-1 text-xs outline-none focus:border-brand/40 text-foreground mb-1.5"
          />
          <div className="flex gap-1.5">
            <button
              onClick={replaceCurrent}
              disabled={matches.length === 0}
              className="flex-1 text-xs py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-brand/40 disabled:opacity-40"
            >
              Replace
            </button>
            <button
              onClick={replaceAll}
              disabled={matches.length === 0}
              className="flex-1 text-xs py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-brand/40 disabled:opacity-40"
            >
              All
            </button>
          </div>
        </>
      )}
    </div>
  )
}
