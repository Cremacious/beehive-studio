'use client'

import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { useBookEditor } from '../book-editor-provider'
import {
  FRONT_MATTER_OPTIONS,
  BACK_MATTER_OPTIONS,
  type Subtype,
} from '@/lib/front-back-matter/types'

type Props = {
  itemId: string
  itemType: 'front_matter' | 'back_matter'
}

export function SubtypePicker({ itemId, itemType }: Props) {
  const { updateBinderItem } = useBookEditor()
  const options = itemType === 'front_matter' ? FRONT_MATTER_OPTIONS : BACK_MATTER_OPTIONS
  const heading = itemType === 'front_matter'
    ? 'What kind of front matter is this?'
    : 'What kind of back matter is this?'

  async function pick(subtype: Subtype) {
    const newContent = { subtype, fields: {} }
    // Optimistic update so the picker is replaced by the form immediately
    updateBinderItem(itemId, { content: newContent })
    await updateBinderItemAction(itemId, { content: newContent })
  }

  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-xl w-full">
        <h2 className="text-lg font-semibold text-foreground mb-4 text-center">{heading}</h2>
        <div className="flex flex-col gap-2">
          {options.map(opt => (
            <button
              key={opt.subtype}
              onClick={() => pick(opt.subtype)}
              className="flex flex-col items-start gap-1 rounded-lg border border-border p-4 text-left hover:border-brand/40 hover:bg-surface-elevated transition-colors"
            >
              <span className="text-sm font-medium text-foreground">{opt.label}</span>
              <span className="text-xs text-muted-foreground">{opt.description}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
