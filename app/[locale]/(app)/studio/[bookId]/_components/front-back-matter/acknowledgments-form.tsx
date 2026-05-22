'use client'

import { useRef, useState } from 'react'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { useBookEditor } from '../book-editor-provider'
import type { AcknowledgmentsFields } from '@/lib/front-back-matter/types'
import { SaveStatusBadge, type FormSaveStatus } from './save-status-badge'

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
  const [saveStatus, setSaveStatus] = useState<FormSaveStatus>('idle')

  function patchText(value: string) {
    const next: AcknowledgmentsFields = { text: value }
    setFields(next)
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      const newContent = { subtype: 'acknowledgments' as const, fields: next }
      updateBinderItem(itemId, { content: newContent })
      const result = await updateBinderItemAction(itemId, { content: newContent })
      setSaveStatus(result.success ? 'saved' : 'unsaved')
    }, 2000)
  }

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <div className="max-w-2xl mx-auto flex flex-col gap-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Acknowledgments</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Thank the people who helped.</p>
          </div>
          <SaveStatusBadge status={saveStatus} />
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
