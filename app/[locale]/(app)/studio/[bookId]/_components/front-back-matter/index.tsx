'use client'

import type { BinderItemRow } from '@/lib/actions/binder.actions'
import type { FrontBackMatterContent } from '@/lib/front-back-matter/types'
import { SubtypePicker } from './subtype-picker'

type Props = {
  item: BinderItemRow
}

// Returns null when this item should fall through to the TipTap editor:
//   - the item is not a front_matter or back_matter type
//   - the item is legacy (content === null) — preserve any prose already saved
//     in chapters.content
//   - the item's subtype is 'custom' — uses chapters.content with TipTap
//
// Returns a React element when the item needs the picker or a specialized form.
export function FrontBackMatterRenderer({ item }: Props): React.ReactElement | null {
  if (item.type !== 'front_matter' && item.type !== 'back_matter') return null
  if (item.content === null || item.content === undefined) return null // legacy

  const content = item.content as FrontBackMatterContent

  if (content.subtype === null) {
    return <SubtypePicker itemId={item.id} itemType={item.type} />
  }

  if (content.subtype === 'custom') return null

  // Specialized forms — wired up in Task 4. Placeholder so this compiles now.
  return (
    <main className="flex-1 flex items-center justify-center p-8 text-sm text-muted-foreground">
      <p>Form for &quot;{content.subtype}&quot; — coming in Task 4.</p>
    </main>
  )
}

// Returns true if this item should use the FrontBackMatterRenderer
// (picker or specialized form). Returns false if it should fall through
// to the TipTap editor (legacy items + 'custom' subtype + non-FM/BM types).
export function shouldUseFrontBackMatterRenderer(item: BinderItemRow): boolean {
  if (item.type !== 'front_matter' && item.type !== 'back_matter') return false
  if (item.content === null || item.content === undefined) return false
  const content = item.content as { subtype?: string | null }
  if (content.subtype === 'custom') return false
  return true
}
