'use client'

import { useRef, useState } from 'react'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { toastActionError, toastNetworkError } from '@/lib/errors/notify'
import { useBookEditor } from '../book-editor-provider'
import type { CopyrightFields } from '@/lib/front-back-matter/types'
import { SaveStatusBadge, type FormSaveStatus } from './save-status-badge'
import { PageWrapper } from './page-wrapper'

// DP3 Task 3 — WYSIWYG inline-edit Copyright page.
//
// Reads top-to-bottom as a real copyright page:
//   © {year} {holder}. All rights reserved.
//   {publisher}
//   ISBN {isbn}
//   [extra notice / rights paragraph]
//
// Inline contenteditable spans for the year/holder/publisher/ISBN; a wider
// contenteditable block for the extra notice.

type Props = {
  itemId: string
  initialFields: Partial<CopyrightFields>
}

export function CopyrightPreview({ itemId, initialFields }: Props) {
  const { updateBinderItem } = useBookEditor()
  const fieldsRef = useRef<CopyrightFields>({
    copyrightYear: initialFields.copyrightYear ?? new Date().getFullYear(),
    copyrightHolder: initialFields.copyrightHolder ?? '',
    publisherName: initialFields.publisherName ?? '',
    isbn: initialFields.isbn ?? '',
    extraNotice: initialFields.extraNotice ?? '',
  })
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saveStatus, setSaveStatus] = useState<FormSaveStatus>('idle')

  function persist(next: CopyrightFields) {
    fieldsRef.current = next
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      const newContent = { subtype: 'copyright' as const, fields: next }
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

  function commitString<K extends 'copyrightHolder' | 'publisherName' | 'isbn' | 'extraNotice'>(
    key: K,
    raw: string,
  ) {
    const next = { ...fieldsRef.current, [key]: raw.trim() }
    if (next[key] === fieldsRef.current[key]) return
    persist(next)
  }

  function commitYear(raw: string) {
    const n = parseInt(raw.trim(), 10)
    if (!Number.isFinite(n)) return
    if (n === fieldsRef.current.copyrightYear) return
    persist({ ...fieldsRef.current, copyrightYear: n })
  }

  const f = fieldsRef.current
  const blockStyle = {
    fontFamily: 'var(--font-prose)',
    fontSize: 11.5,
    lineHeight: 1.75,
    color: 'var(--paper-ink)',
    margin: '120px 0 0',
    textAlign: 'left' as const,
  }

  return (
    <PageWrapper saveStatusBadge={<SaveStatusBadge status={saveStatus} />}>
      <div style={blockStyle}>
        <p style={{ margin: '0 0 1em' }}>
          Copyright ©{' '}
          <span
            contentEditable
            suppressContentEditableWarning
            onBlur={e => commitYear(e.currentTarget.textContent ?? '')}
            className="bp-field"
            style={{ display: 'inline-block', minWidth: 48 }}
            data-placeholder="YYYY"
          >
            {f.copyrightYear}
          </span>{' '}
          <span
            contentEditable
            suppressContentEditableWarning
            onBlur={e => commitString('copyrightHolder', e.currentTarget.textContent ?? '')}
            className="bp-field"
            style={{ display: 'inline-block', minWidth: 120 }}
            data-placeholder="Copyright holder"
          >
            {f.copyrightHolder}
          </span>
        </p>
        <p style={{ margin: '0 0 1em' }}>All rights reserved.</p>
        <p style={{ margin: '0 0 1em' }}>
          <span
            contentEditable
            suppressContentEditableWarning
            onBlur={e => commitString('publisherName', e.currentTarget.textContent ?? '')}
            className="bp-field"
            style={{ display: 'inline-block', minWidth: 120 }}
            data-placeholder="Publisher (optional)"
          >
            {f.publisherName ?? ''}
          </span>
        </p>
        <p style={{ margin: '0 0 1em', fontFamily: 'var(--font-mono)' }}>
          ISBN{' '}
          <span
            contentEditable
            suppressContentEditableWarning
            onBlur={e => commitString('isbn', e.currentTarget.textContent ?? '')}
            className="bp-field"
            style={{ display: 'inline-block', minWidth: 140 }}
            data-placeholder="000-0-0000000-0-0"
          >
            {f.isbn ?? ''}
          </span>
        </p>
        <div
          contentEditable
          suppressContentEditableWarning
          onBlur={e => commitString('extraNotice', e.currentTarget.textContent ?? '')}
          className="bp-field"
          style={{
            fontSize: 11.5,
            color: 'var(--paper-ink-muted)',
            textAlign: 'left',
            marginTop: 28,
            fontStyle: 'italic',
            minHeight: '2em',
          }}
          data-placeholder="Additional rights / disclaimer text (optional)"
        >
          {f.extraNotice ?? ''}
        </div>
      </div>
    </PageWrapper>
  )
}
