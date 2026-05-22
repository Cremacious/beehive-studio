'use client'

import { useRef, useState } from 'react'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { useBookEditor } from '../book-editor-provider'
import type { DedicationFields } from '@/lib/front-back-matter/types'

const MAX = 500

type Props = {
  itemId: string
  initialFields: Partial<DedicationFields>
}

export function DedicationForm({ itemId, initialFields }: Props) {
  const { updateBinderItem } = useBookEditor()
  const [fields, setFields] = useState<DedicationFields>({
    text: initialFields.text ?? '',
  })
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function patchText(value: string) {
    const next: DedicationFields = { text: value }
    setFields(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const newContent = { subtype: 'dedication' as const, fields: next }
      updateBinderItem(itemId, { content: newContent })
      await updateBinderItemAction(itemId, { content: newContent })
    }, 2000)
  }

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <div className="max-w-2xl mx-auto flex flex-col gap-5">
        <header>
          <h2 className="text-lg font-semibold text-foreground">Dedication</h2>
          <p className="text-xs text-muted-foreground mt-0.5">A short note to whom this book is for.</p>
        </header>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Dedication text</span>
          <textarea
            value={fields.text}
            onChange={e => patchText(e.target.value)}
            rows={8}
            maxLength={MAX}
            className="bg-surface-inset border border-border rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-brand/40 transition-colors resize-y"
          />
          <p className="text-[11px] text-muted-foreground self-end">{fields.text.length} / {MAX}</p>
        </label>
      </div>
    </main>
  )
}
