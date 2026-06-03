'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { MessageSquare, Edit3 } from 'lucide-react'
import type { Editor } from '@tiptap/react'
import { useSelectionPopover } from '@/lib/hooks/use-selection-popover'
import { AnnotateModal } from './annotate-modal'
import { SuggestModal } from './suggest-modal'

type Props = {
  editor: Editor
  hiveId: string
  chapterId: string
  canAnnotate: boolean
  canSuggestEdits: boolean
  onAnnotationCreated?: () => void
  onSuggestionCreated?: () => void
}

const POPOVER_WIDTH = 200
const POPOVER_HEIGHT = 40
const GAP = 8

export function SelectionPopover({
  editor,
  hiveId,
  chapterId,
  canAnnotate,
  canSuggestEdits,
  onAnnotationCreated,
  onSuggestionCreated,
}: Props) {
  const sel = useSelectionPopover(editor)
  const [annotateOpen, setAnnotateOpen] = useState(false)
  const [suggestOpen, setSuggestOpen] = useState(false)

  const hasText = sel.text !== null
  const hasAnyAction = canAnnotate || canSuggestEdits
  const showPopover =
    hasText && hasAnyAction && !annotateOpen && !suggestOpen

  if (typeof document === 'undefined') return null

  // Position above the selection (clamped to viewport when possible).
  let style: React.CSSProperties = { display: 'none' }
  if (showPopover && sel.anchorRect) {
    const centerX = sel.anchorRect.left + sel.anchorRect.width / 2
    const left = Math.max(8, centerX - POPOVER_WIDTH / 2)
    const top = Math.max(8, sel.anchorRect.top - POPOVER_HEIGHT - GAP)
    style = {
      position: 'fixed',
      left,
      top,
      width: POPOVER_WIDTH,
      zIndex: 60,
    }
  }

  // Capture selection state so the modal can use it even after the popover
  // unmounts (the selection update on dialog focus could otherwise blow it
  // away). Stored when opening a modal.
  const [captured, setCaptured] = useState<{
    from: number
    to: number
    text: string
  } | null>(null)

  function openAnnotate() {
    if (sel.from === null || sel.to === null || sel.text === null) return
    setCaptured({ from: sel.from, to: sel.to, text: sel.text })
    setAnnotateOpen(true)
  }
  function openSuggest() {
    if (sel.from === null || sel.to === null || sel.text === null) return
    setCaptured({ from: sel.from, to: sel.to, text: sel.text })
    setSuggestOpen(true)
  }

  const popoverNode = showPopover ? (
    <div
      role="toolbar"
      aria-label="Collaboration actions"
      style={{
        ...style,
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        border: 'var(--br-card)',
      }}
      // Without this, mousedown on any popover button shifts focus off the
      // (editable) TipTap editor → editor emits `blur` → useSelectionPopover
      // hook clears state to null → by the time the click handler resolves,
      // openAnnotate / openSuggest see sel.{from,to,text} === null and bail.
      // The hive chapter view doesn't trip this because that editor is
      // `editable: false` and blur fires differently. Preventing mousedown's
      // default keeps the editor focused so the selection survives.
      onMouseDown={(e) => e.preventDefault()}
      className="flex items-center gap-1 px-2 py-1"
    >
      <button
        type="button"
        onClick={openAnnotate}
        disabled={!canAnnotate}
        aria-label="Annotate selection"
        style={{ borderRadius: 'var(--r-btn)' }}
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Annotate
      </button>
      <button
        type="button"
        onClick={openSuggest}
        disabled={!canSuggestEdits}
        aria-label="Suggest edit"
        style={{ borderRadius: 'var(--r-btn)' }}
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Edit3 className="h-3.5 w-3.5" />
        Suggest edit
      </button>
    </div>
  ) : null

  return (
    <>
      {popoverNode ? createPortal(popoverNode, document.body) : null}
      {captured ? (
        <>
          <AnnotateModal
            open={annotateOpen}
            onOpenChange={(next) => {
              setAnnotateOpen(next)
              if (!next) {
                // Selection probably gone; let parent refresh + close popover.
                sel.close()
              }
            }}
            editor={editor}
            hiveId={hiveId}
            chapterId={chapterId}
            from={captured.from}
            to={captured.to}
            selectedText={captured.text}
            onSuccess={() => {
              onAnnotationCreated?.()
              sel.close()
            }}
          />
          <SuggestModal
            open={suggestOpen}
            onOpenChange={(next) => {
              setSuggestOpen(next)
              if (!next) sel.close()
            }}
            editor={editor}
            hiveId={hiveId}
            chapterId={chapterId}
            from={captured.from}
            to={captured.to}
            selectedText={captured.text}
            onSuccess={() => {
              onSuggestionCreated?.()
              sel.close()
            }}
          />
        </>
      ) : null}
    </>
  )
}
