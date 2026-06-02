'use client'

import { useBookEditor } from './book-editor-provider'
import { MetadataPanel } from './metadata/metadata-panel'
import { VersionHistoryDrawer } from './editor/version-history-drawer'
import { EditorStatusBar } from './editor/editor-status-bar'

// Right-side slot of the studio layout. A vertical stack of:
//   1) EditorStatusBar — always visible (even with no chapter selected)
//   2) Metadata panel OR Version history drawer (swap on historyOpen)
//
// Each child renders its own card chrome. The wrapper is just a flex column
// providing the gap between them; width is owned by the panels themselves
// (w-60 / w-64) so the column hugs the wider of the two.
//
// H3 T12 note: the collaboration gutter is NOT mounted here. It needs a
// reference to the TipTap editor instance (for coordsAtPos anchoring),
// which lives inside ChapterEditor and shouldn't be lifted into context.
// The gutter mounts inline inside ChapterEditor's chapter-render branch
// as a sibling column, controlled by `gutterOpen` from the provider.
export function RightPanelSlot() {
  const { historyOpen, focusMode } = useBookEditor()
  return (
    <div
      className={
        focusMode
          ? 'pointer-events-none opacity-0 -translate-x-2 transition-[opacity,transform] duration-200 ease-out flex-shrink-0 w-0'
          : 'flex flex-col gap-2 flex-shrink-0 h-full min-h-0 transition-[opacity,transform] duration-200 ease-out'
      }
      aria-hidden={focusMode}
    >
      <EditorStatusBar />
      {historyOpen ? <VersionHistoryDrawer /> : <MetadataPanel />}
    </div>
  )
}
