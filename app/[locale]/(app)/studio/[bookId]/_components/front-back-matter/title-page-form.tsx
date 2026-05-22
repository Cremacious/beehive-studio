'use client'

import { useRef, useState } from 'react'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { useBookEditor } from '../book-editor-provider'
import type { TitlePageFields } from '@/lib/front-back-matter/types'
import { SaveStatusBadge, type FormSaveStatus } from './save-status-badge'

type Props = {
  itemId: string
  initialFields: Partial<TitlePageFields>
}

export function TitlePageForm({ itemId, initialFields }: Props) {
  const { bookTitle, updateBinderItem } = useBookEditor()
  const [fields, setFields] = useState<TitlePageFields>({
    bookTitle: initialFields.bookTitle ?? bookTitle,
    subtitle: initialFields.subtitle ?? '',
    authorName: initialFields.authorName ?? '',
    publisherName: initialFields.publisherName ?? '',
  })
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saveStatus, setSaveStatus] = useState<FormSaveStatus>('idle')

  function patch<K extends keyof TitlePageFields>(key: K, value: TitlePageFields[K]) {
    const next = { ...fields, [key]: value }
    setFields(next)
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      const newContent = { subtype: 'title_page' as const, fields: next }
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
            <h2 className="text-lg font-semibold text-foreground">Title Page</h2>
            <p className="text-xs text-muted-foreground mt-0.5">The opening page of your book.</p>
          </div>
          <SaveStatusBadge status={saveStatus} />
        </header>

        <TextField label="Book title" value={fields.bookTitle} onChange={v => patch('bookTitle', v)} />
        <TextField label="Subtitle (optional)" value={fields.subtitle ?? ''} onChange={v => patch('subtitle', v)} />
        <TextField label="Author name" value={fields.authorName} onChange={v => patch('authorName', v)} />
        <TextField label="Publisher (optional)" value={fields.publisherName ?? ''} onChange={v => patch('publisherName', v)} />
      </div>
    </main>
  )
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-surface-inset border border-border rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-brand/40 transition-colors"
      />
    </label>
  )
}
