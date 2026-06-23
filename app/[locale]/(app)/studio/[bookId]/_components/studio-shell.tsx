'use client'

import { BinderTree } from './binder/binder-tree'
import { CorkboardOrEditor } from './corkboard-or-editor'
import { RightPanelSlot } from './right-panel-slot'
import { ResizeHandle } from './resize-handle'
import { useBookEditor } from './book-editor-provider'

// Client shell composing the three studio columns + the two drag handles
// between them. Handles + column widths are wired to the editor provider's
// resizable panel state (issue #36).
export function StudioShell() {
  const { binderPanel, metadataPanel, focusMode } = useBookEditor()

  const binderHidden = focusMode || binderPanel.collapsed
  const metadataHidden = focusMode || metadataPanel.collapsed

  return (
    /* The (app) layout uses min-h-screen (not h-screen), so h-full on a
       flex-1 ancestor resolves to content-height — not viewport. Pin the
       studio columns to viewport-minus-nav (h-14 = 56px) so the binder /
       editor / metadata fill the screen instead of stopping ~80% down. */
    <div className="flex gap-2 h-[calc(100vh-68px)] overflow-hidden">
      <BinderTree />
      {!binderHidden && (
        <ResizeHandle
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
    </div>
  )
}
