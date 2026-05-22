'use client'

import { useRef, useState } from 'react'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { useBookEditor } from '../book-editor-provider'
import type { AcknowledgmentsFields } from '@/lib/front-back-matter/types'

type Props = {
  itemId: string
  initialFields: Partial<AcknowledgmentsFields>
}

export function AcknowledgmentsForm({ itemId, initialFields }: Props) {
  const { updateBinderItem } = useBookEditor()
  const [fields, setFields] = useState<AcknowledgmentsFields>({
    text: initialFields.text ?? '',
  })
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function patchText(value: string) {
    const next: AcknowledgmentsFields = { text: value }
    setFields(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const newContent = { subtype: 'acknowledgments' as const, fields: next }
      updateBinderItem(itemId, { content: newContent })
      await updateBinderItemAction(itemId, { content: newContent })
    }, 2000)
  }

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <div className="max-w-2xl mx-auto flex flex-col gap-5">
        <header>
          <h2 className="text-lg font-semibold text-foreground">Acknowledgments</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Thank the people who helped.</p>
        </header>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Acknowledgments</span>
          <textarea
            value={fields.text}
            onChange={e => patchText(e.target.value)}
            rows={14}
            className="bg-surface-inset border border-border rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-brand/40 transition-colors resize-y"
          />
        </label>
      </div>
    </main>
  )
}
