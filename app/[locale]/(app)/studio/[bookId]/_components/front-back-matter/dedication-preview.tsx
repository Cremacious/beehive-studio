'use client'

import { useRef, useState } from 'react'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { toastActionError, toastNetworkError } from '@/lib/errors/notify'
import { useBookEditor } from '../book-editor-provider'
import type { DedicationFields } from '@/lib/front-back-matter/types'
import { SaveStatusBadge, type FormSaveStatus } from './save-status-badge'
import { PageWrapper } from './page-wrapper'

// DP3 Task 3 — WYSIWYG Dedication.
// Single centered italic phrase, large top margin (per mockup .bp-dedication).

type Props = {
  itemId: string
  initialFields: Partial<DedicationFields>
}

export function DedicationPreview({ itemId, initialFields }: Props) {
  const { updateBinderItem } = useBookEditor()
  const fieldsRef = useRef<DedicationFields>({
    text: initialFields.text ?? '',
  })
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saveStatus, setSaveStatus] = useState<FormSaveStatus>('idle')

  function commit(raw: string) {
    const trimmed = raw.trim()
    if (trimmed === fieldsRef.current.text) return
    const next: DedicationFields = { text: trimmed }
    fieldsRef.current = next
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      const newContent = { subtype: 'dedication' as const, fields: next }
      updateBinderItem(itemId, { content: newContent })
      try {
        const result = await updateBinderItemAction(itemId, { content: newContent })
        // Keep the user's edits on failure; just surface the error.
        setSaveStatus(result.success ? 'saved' : 'unsaved')
        if (!result.success) toastActionError(result.error)
      } catch {
        setSaveStatus('unsaved')
        toastNetworkError()
      }
    }, 1500)
  }

  return (
    <PageWrapper saveStatusBadge={<SaveStatusBadge status={saveStatus} />} variant="tall">
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={e => commit(e.currentTarget.textContent ?? '')}
        className="bp-field"
        style={{
          margin: '36% auto 0',
          textAlign: 'center',
          fontFamily: 'var(--font-prose)',
          fontSize: 15,
          fontStyle: 'italic',
          fontWeight: 400,
          lineHeight: 1.4,
          color: 'var(--paper-ink-strong)',
          maxWidth: 360,
          textWrap: 'balance',
          minHeight: '2em',
        }}
        data-placeholder="For…"
      >
        {fieldsRef.current.text}
      </div>
    </PageWrapper>
  )
}
