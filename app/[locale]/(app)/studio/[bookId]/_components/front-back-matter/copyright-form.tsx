'use client'

import { useRef, useState } from 'react'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { useBookEditor } from '../book-editor-provider'
import type { CopyrightFields } from '@/lib/front-back-matter/types'
import { SaveStatusBadge, type FormSaveStatus } from './save-status-badge'

type Props = {
  itemId: string
  initialFields: Partial<CopyrightFields>
}

export function CopyrightForm({ itemId, initialFields }: Props) {
  const { updateBinderItem } = useBookEditor()
  const [fields, setFields] = useState<CopyrightFields>({
    copyrightYear: initialFields.copyrightYear ?? new Date().getFullYear(),
    copyrightHolder: initialFields.copyrightHolder ?? '',
    publisherName: initialFields.publisherName ?? '',
    isbn: initialFields.isbn ?? '',
    extraNotice: initialFields.extraNotice ?? '',
  })
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saveStatus, setSaveStatus] = useState<FormSaveStatus>('idle')

  function patch<K extends keyof CopyrightFields>(key: K, value: CopyrightFields[K]) {
    const next = { ...fields, [key]: value }
    setFields(next)
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      const newContent = { subtype: 'copyright' as const, fields: next }
      updateBinderItem(itemId, { content: newContent })
      const result = await updateBinderItemAction(itemId, { content: newContent })
      setSaveStatus(result.success ? 'saved' : 'unsaved')
    }, 2000)
  }

  function patchYear(value: string) {
    const n = parseInt(value, 10)
    if (!Number.isFinite(n)) return
    patch('copyrightYear', n)
  }

  const inputClass = 'bg-surface-inset border border-border rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-brand/40 transition-colors'
  const labelClass = 'text-xs text-muted-foreground uppercase tracking-wide font-medium'

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <div className="max-w-2xl mx-auto flex flex-col gap-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Copyright</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Legal info shown after the title page.</p>
          </div>
          <SaveStatusBadge status={saveStatus} />
        </header>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Copyright year</span>
          <input
            type="number"
            value={fields.copyrightYear}
            onChange={e => patchYear(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Copyright holder</span>
          <input
            type="text"
            value={fields.copyrightHolder}
            onChange={e => patch('copyrightHolder', e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Publisher (optional)</span>
          <input
            type="text"
            value={fields.publisherName ?? ''}
            onChange={e => patch('publisherName', e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>ISBN (optional)</span>
          <input
            type="text"
            value={fields.isbn ?? ''}
            onChange={e => patch('isbn', e.target.value)}
            className={`${inputClass} font-mono`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Extra notice (optional)</span>
          <textarea
            value={fields.extraNotice ?? ''}
            onChange={e => patch('extraNotice', e.target.value)}
            rows={4}
            className={`${inputClass} resize-y`}
          />
        </label>
      </div>
    </main>
  )
}
