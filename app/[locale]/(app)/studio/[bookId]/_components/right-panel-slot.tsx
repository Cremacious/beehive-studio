'use client'

import { useBookEditor } from './book-editor-provider'
import { MetadataPanel } from './metadata/metadata-panel'
import { VersionHistoryDrawer } from './editor/version-history-drawer'

// Right-side slot of the studio layout: switches between MetadataPanel and
// VersionHistoryDrawer based on the provider's historyOpen flag. The page
// is a server component and can't read the provider directly, so the swap
// is encapsulated here. MetadataPanel keeps its own historyOpen guard as
// defense-in-depth.
//
// H3 T12 note: the collaboration gutter is NOT mounted here. It needs a
// reference to the TipTap editor instance (for coordsAtPos anchoring),
// which lives inside ChapterEditor and shouldn't be lifted into context
// (heavyweight, with subscriptions). The gutter mounts inline inside
// ChapterEditor's chapter-render branch as a sibling column, controlled by
// `gutterOpen` from the provider. This slot stays metadata-or-history.
export function RightPanelSlot() {
  const { historyOpen } = useBookEditor()
  return historyOpen ? <VersionHistoryDrawer /> : <MetadataPanel />
}
