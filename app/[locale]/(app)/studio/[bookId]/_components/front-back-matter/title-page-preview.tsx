'use client'

import { useRef, useState } from 'react'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { useBookEditor } from '../book-editor-provider'
import type { TitlePageFields } from '@/lib/front-back-matter/types'
import { SaveStatusBadge, type FormSaveStatus } from './save-status-badge'
import { PageWrapper } from './page-wrapper'

// DP3 Task 3 — WYSIWYG inline-edit Title Page.
//
// Centered display typography on cream paper, contenteditable fields for
// title/subtitle/byline/author. Saves via `updateBinderItemAction` to
// binderItems.content with shape { subtype: 'title_page', fields }.

type Props = {
  itemId: string
  initialFields: Partial<TitlePageFields>
}

export function TitlePagePreview({ itemId, initialFields }: Props) {
  const { bookTitle, updateBinderItem } = useBookEditor()
  const fieldsRef = useRef<TitlePageFields>({
    bookTitle: initialFields.bookTitle ?? bookTitle,
    subtitle: initialFields.subtitle ?? '',
    authorName: initialFields.authorName ?? '',
    publisherName: initialFields.publisherName ?? '',
  })
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saveStatus, setSaveStatus] = useState<FormSaveStatus>('idle')

  function commit<K extends keyof TitlePageFields>(key: K, raw: string) {
    const next: TitlePageFields = { ...fieldsRef.current, [key]: raw.trim() }
    if (next[key] === fieldsRef.current[key]) return
    fieldsRef.current = next
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      const newContent = { subtype: 'title_page' as const, fields: next }
      updateBinderItem(itemId, { content: newContent })
      const result = await updateBinderItemAction(itemId, { content: newContent })
      setSaveStatus(result.success ? 'saved' : 'unsaved')
    }, 1500)
  }

  const f = fieldsRef.current

  return (
    <PageWrapper saveStatusBadge={<SaveStatusBadge status={saveStatus} />}>
      <div style={{ textAlign: 'center', margin: '80px 0 56px' }}>
        <h1
          contentEditable
          suppressContentEditableWarning
          onBlur={e => commit('bookTitle', e.currentTarget.textContent ?? '')}
          className="bp-field"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            lineHeight: 1.1,
            color: 'var(--paper-ink-strong)',
            margin: '0 0 10px',
            textWrap: 'balance',
          }}
          data-placeholder="Book Title"
        >
          {f.bookTitle}
        </h1>
        <p
          contentEditable
          suppressContentEditableWarning
          onBlur={e => commit('subtitle', e.currentTarget.textContent ?? '')}
          className="bp-field"
          style={{
            fontFamily: 'var(--font-prose)',
            fontSize: 15,
            fontStyle: 'italic',
            fontWeight: 400,
            lineHeight: 1.4,
            color: 'var(--paper-ink-muted)',
            margin: 0,
            textWrap: 'balance',
          }}
          data-placeholder="Subtitle (optional)"
        >
          {f.subtitle ?? ''}
        </p>
      </div>

      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: 'var(--paper-400)',
          margin: '64px 0 10px',
          textAlign: 'center',
        }}
      >
        a novel by
      </div>
      <p
        contentEditable
        suppressContentEditableWarning
        onBlur={e => commit('authorName', e.currentTarget.textContent ?? '')}
        className="bp-field"
        style={{
          fontFamily: 'var(--font-prose)',
          fontSize: 16,
          fontStyle: 'italic',
          fontWeight: 400,
          color: 'var(--paper-ink-strong)',
          textAlign: 'center',
          margin: 0,
        }}
        data-placeholder="Author Name"
      >
        {f.authorName}
      </p>

      <div
        aria-hidden
        style={{
          margin: '80px auto 0',
          textAlign: 'center',
          color: 'var(--paper-400)',
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          letterSpacing: '0.5em',
          userSelect: 'none',
        }}
      >
        ❦
      </div>

      <div style={{ marginTop: 40, textAlign: 'center' }}>
        <span
          contentEditable
          suppressContentEditableWarning
          onBlur={e => commit('publisherName', e.currentTarget.textContent ?? '')}
          className="bp-field"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--paper-ink-muted)',
            display: 'inline-block',
            minWidth: 120,
          }}
          data-placeholder="Publisher (optional)"
        >
          {f.publisherName ?? ''}
        </span>
      </div>
    </PageWrapper>
  )
}
