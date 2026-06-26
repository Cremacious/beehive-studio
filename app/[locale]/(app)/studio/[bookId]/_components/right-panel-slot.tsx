'use client'

import { useBookEditor } from './book-editor-provider'
import { MetadataPanel } from './metadata/metadata-panel'
import { VersionHistoryDrawer } from './editor/version-history-drawer'
import { EditorStatusBar } from './editor/editor-status-bar'

// Right-side slot of the studio layout. A vertical stack of:
//   1) EditorStatusBar — always visible (even with no chapter selected)
//   2) Metadata panel OR Version history drawer (swap on historyOpen)
//
// Width + collapsed state are owned here (driven by metadataPanel from the
// editor provider). Children stretch to fill via w-full.
//
// H3 T12 note: the collaboration gutter is NOT mounted here. It needs a
// reference to the TipTap editor instance (for coordsAtPos anchoring),
// which lives inside ChapterEditor and shouldn't be lifted into context.
// The gutter mounts inline inside ChapterEditor's chapter-render branch
// as a sibling column, controlled by `gutterOpen` from the provider.
export function RightPanelSlot({ mobile = false }: { mobile?: boolean } = {}) {
  const { historyOpen, focusMode, metadataPanel } = useBookEditor()
  // On mobile the metadata/history panel is an overlay drawer (issue #50):
  // the drawer wrapper owns visibility, so it always renders + fills the drawer.
  const hidden = mobile ? false : (focusMode || metadataPanel.collapsed)

  return (
    <div
      style={{
        width: mobile ? '100%' : (hidden ? 0 : metadataPanel.width),
        transition: mobile
          ? 'none'
          : metadataPanel.isDragging
          ? 'none'
          : 'width 200ms ease-out, opacity 200ms ease-out, transform 200ms ease-out',
      }}
      className={
        hidden
          ? 'pointer-events-none opacity-0 -translate-x-2 flex-shrink-0 overflow-hidden'
          : 'flex flex-col gap-2 flex-shrink-0 h-full min-h-0 overflow-hidden'
      }
      aria-hidden={hidden}
    >
      {!hidden && (
        <>
          <EditorStatusBar />
          {historyOpen ? <VersionHistoryDrawer /> : <MetadataPanel />}
        </>
      )}
    </div>
  )
}
