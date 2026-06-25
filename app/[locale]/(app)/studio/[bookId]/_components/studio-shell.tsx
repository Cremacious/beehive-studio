'use client'

import { useRef } from 'react'
import { BinderTree } from './binder/binder-tree'
import { CorkboardOrEditor } from './corkboard-or-editor'
import { RightPanelSlot } from './right-panel-slot'
import { ResizeHandle } from './resize-handle'
import { useBookEditor } from './book-editor-provider'
import { PageExplainer } from '@/components/tips/page-explainer'
import { CoachMark } from '@/components/tips/coach-mark'
import { useDismissedTips } from '@/lib/tips/use-dismissed-tips'

// Client shell composing the three studio columns + the two drag handles
// between them. Handles + column widths are wired to the editor provider's
// resizable panel state (issue #36).
export function StudioShell() {
  const { binderPanel, metadataPanel, focusMode } = useBookEditor()

  const binderHidden = focusMode || binderPanel.collapsed
  const metadataHidden = focusMode || metadataPanel.collapsed

  // Anchor for the panel-resize coach mark (issue #44).
  const leftHandleRef = useRef<HTMLDivElement>(null)

  // Queue tips one-per-surface: the resize coach mark waits until the editor
  // intro explainer is dismissed so two popups never stack on first visit.
  const { hydrated, isDismissed } = useDismissedTips()
  const resizeTipEnabled = hydrated && isDismissed('editor-intro') && !binderHidden

  return (
    /* The (app) layout uses min-h-screen (not h-screen), so h-full on a
       flex-1 ancestor resolves to content-height — not viewport. Pin the
       studio columns to viewport-minus-nav (h-14 = 56px) so the binder /
       editor / metadata fill the screen instead of stopping ~80% down. */
    <div className="flex gap-2 h-[calc(100vh-68px)] overflow-hidden">
      <BinderTree />
      {!binderHidden && (
        <ResizeHandle
          ref={leftHandleRef}
          side="left"
          isDragging={binderPanel.isDragging}
          onPointerDown={binderPanel.startDrag}
          ariaLabel="Resize binder panel"
        />
      )}
      <CorkboardOrEditor />
      {!metadataHidden && (
        <ResizeHandle
          side="right"
          isDragging={metadataPanel.isDragging}
          onPointerDown={metadataPanel.startDrag}
          ariaLabel="Resize metadata panel"
        />
      )}
      <RightPanelSlot />

      {/* First-visit guidance for new writers. */}
      <PageExplainer tipKey="editor-intro" />
      <CoachMark
        tipKey="editor-resize-panels"
        anchorRef={leftHandleRef}
        placement="right"
        enabled={resizeTipEnabled}
      />
    </div>
  )
}
