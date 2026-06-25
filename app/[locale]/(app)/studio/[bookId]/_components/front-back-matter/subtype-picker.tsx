'use client'

import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { useBookEditor } from '../book-editor-provider'
import { toastActionError, toastNetworkError } from '@/lib/errors/notify'
import {
  FRONT_MATTER_OPTIONS,
  BACK_MATTER_OPTIONS,
  type Subtype,
} from '@/lib/front-back-matter/types'

// DP3 Task 3 — Pill-toolbar subtype picker.
//
// One of the 5 sanctioned brand-yellow uses: the active subtype pill is
// solid `bg-brand text-brand-ink`. Inactive pills are chrome-neutral. Sits
// above the book page on the FM/BM pane. Renders for both the empty
// (no-subtype) and active states; in the empty state, no pill is active.

type Props = {
  itemId: string
  itemType: 'front_matter' | 'back_matter'
  activeSubtype?: Subtype | null
}

export function SubtypePicker({ itemId, itemType, activeSubtype }: Props) {
  const { updateBinderItem } = useBookEditor()
  const options = itemType === 'front_matter' ? FRONT_MATTER_OPTIONS : BACK_MATTER_OPTIONS

  async function pick(subtype: Subtype) {
    if (subtype === activeSubtype) return
    const newContent = { subtype, fields: {} }
    const previousContent = { subtype: activeSubtype ?? null, fields: {} }
    updateBinderItem(itemId, { content: newContent })
    try {
      const result = await updateBinderItemAction(itemId, { content: newContent })
      if (!result.success) {
        updateBinderItem(itemId, { content: previousContent })
        toastActionError(result.error)
      }
    } catch {
      updateBinderItem(itemId, { content: previousContent })
      toastNetworkError()
    }
  }

  return (
    <div
      data-slot="fbm-subtype-bar"
      className="flex items-center justify-center px-6 py-3 border-b border-border bg-surface"
    >
      <div
        className="inline-flex items-center gap-0 p-1 rounded-full"
        style={{
          background: 'var(--chrome-950, var(--background))',
          border: '1px solid var(--border)',
          boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.3)',
        }}
        role="tablist"
        aria-label={itemType === 'front_matter' ? 'Front-matter subtype' : 'Back-matter subtype'}
      >
        {options.map(opt => {
          const isActive = opt.subtype === activeSubtype
          return (
            <button
              key={opt.subtype}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => pick(opt.subtype)}
              title={opt.description}
              className="inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
              style={{
                padding: '6px 14px',
                borderRadius: 9999,
                fontFamily: 'var(--font-display)',
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.005em',
                background: isActive ? 'var(--color-brand)' : 'transparent',
                color: isActive
                  ? 'var(--brand-ink, oklch(0.18 0.022 50))'
                  : 'var(--muted-foreground)',
                border: 0,
                cursor: 'pointer',
                boxShadow: isActive ? '0 2px 6px rgba(0,0,0,0.25)' : undefined,
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
