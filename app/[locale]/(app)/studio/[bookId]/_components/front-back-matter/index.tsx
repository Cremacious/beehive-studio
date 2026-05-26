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
import { TitlePagePreview } from './title-page-preview'
import { CopyrightPreview } from './copyright-preview'
import { DedicationPreview } from './dedication-preview'
import { AcknowledgmentsPreview } from './acknowledgments-preview'
import { AboutAuthorPreview } from './about-author-preview'

type Props = {
  item: BinderItemRow
}

// DP3 Task 3 — FM/BM dispatcher.
//
// Routes by `content.subtype` to one of 5 WYSIWYG previews. The subtype-
// picker pill bar is always rendered above the page (so the user can switch
// subtypes); when no subtype is set, the bar shows with no active pill and
// the page area shows an empty-state prompt.
//
// Returns null when:
//   - the item is not a front_matter / back_matter type
//   - the item is legacy (content === null) — falls through to TipTap so
//     existing prose in chapters.content is preserved
//   - the item's subtype is 'custom' — falls through to TipTap
export function FrontBackMatterRenderer({ item }: Props): React.ReactElement | null {
  if (item.type !== 'front_matter' && item.type !== 'back_matter') return null
  if (item.content === null || item.content === undefined) return null // legacy

  const content = item.content as FrontBackMatterContent

  if (content.subtype === 'custom') return null

  const subtype = content.subtype
  const fields = (content.fields ?? {}) as Record<string, unknown>

  return (
    <main className="flex-1 flex flex-col overflow-hidden relative">
      <SubtypePicker itemId={item.id} itemType={item.type} activeSubtype={subtype} />
      {subtype === null && <EmptyState />}
      {subtype === 'title_page' && (
        <TitlePagePreview itemId={item.id} initialFields={fields as Partial<TitlePageFields>} />
      )}
      {subtype === 'copyright' && (
        <CopyrightPreview itemId={item.id} initialFields={fields as Partial<CopyrightFields>} />
      )}
      {subtype === 'dedication' && (
        <DedicationPreview itemId={item.id} initialFields={fields as Partial<DedicationFields>} />
      )}
      {subtype === 'acknowledgments' && (
        <AcknowledgmentsPreview
          itemId={item.id}
          initialFields={fields as Partial<AcknowledgmentsFields>}
        />
      )}
      {subtype === 'about_author' && (
        <AboutAuthorPreview
          itemId={item.id}
          initialFields={fields as Partial<AboutAuthorFields>}
        />
      )}
    </main>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div
        className="text-center max-w-sm"
        style={{
          padding: '48px 32px',
          border: '1.5px dashed var(--border)',
          borderRadius: 8,
          background: 'oklch(0.18 0.012 60 / 0.4)',
        }}
      >
        <h3
          className="mb-2"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--foreground)',
          }}
        >
          Pick a subtype above
        </h3>
        <p className="text-sm text-muted-foreground" style={{ lineHeight: 1.5 }}>
          Choose Title Page, Copyright, Dedication, Acknowledgments, or About
          Author to set up this page.
        </p>
      </div>
    </div>
  )
}

// Returns true if this item should use the FrontBackMatterRenderer
// (picker or specialized preview). Returns false if it should fall through
// to the TipTap editor (legacy items + 'custom' subtype + non-FM/BM types).
export function shouldUseFrontBackMatterRenderer(item: BinderItemRow): boolean {
  if (item.type !== 'front_matter' && item.type !== 'back_matter') return false
  if (item.content === null || item.content === undefined) return false
  const content = item.content as { subtype?: string | null }
  if (content.subtype === 'custom') return false
  return true
}
