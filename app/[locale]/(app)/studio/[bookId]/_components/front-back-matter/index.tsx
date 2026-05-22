'use client'

import type { BinderItemRow } from '@/lib/actions/binder.actions'
import type {
  FrontBackMatterContent,
  TitlePageFields,
  CopyrightFields,
  DedicationFields,
  AcknowledgmentsFields,
  AboutAuthorFields,
} from '@/lib/front-back-matter/types'
import { SubtypePicker } from './subtype-picker'
import { TitlePageForm } from './title-page-form'
import { CopyrightForm } from './copyright-form'
import { DedicationForm } from './dedication-form'
import { AcknowledgmentsForm } from './acknowledgments-form'
import { AboutAuthorForm } from './about-author-form'

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

  const fields = content.fields as Record<string, unknown>

  switch (content.subtype) {
    case 'title_page':
      return <TitlePageForm itemId={item.id} initialFields={fields as Partial<TitlePageFields>} />
    case 'copyright':
      return <CopyrightForm itemId={item.id} initialFields={fields as Partial<CopyrightFields>} />
    case 'dedication':
      return <DedicationForm itemId={item.id} initialFields={fields as Partial<DedicationFields>} />
    case 'acknowledgments':
      return <AcknowledgmentsForm itemId={item.id} initialFields={fields as Partial<AcknowledgmentsFields>} />
    case 'about_author':
      return <AboutAuthorForm itemId={item.id} initialFields={fields as Partial<AboutAuthorFields>} />
    default:
      return null
  }
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
