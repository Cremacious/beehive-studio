'use client'

import { useBookEditor } from './book-editor-provider'
import { MetadataPanel } from './metadata/metadata-panel'
import { VersionHistoryDrawer } from './editor/version-history-drawer'

// Right-side slot of the studio layout: switches between MetadataPanel and
// VersionHistoryDrawer based on the provider's historyOpen flag. The page
// is a server component and can't read the provider directly, so the swap
// is encapsulated here. MetadataPanel keeps its own historyOpen guard as
// defense-in-depth.
export function RightPanelSlot() {
  const { historyOpen } = useBookEditor()
  return historyOpen ? <VersionHistoryDrawer /> : <MetadataPanel />
}
