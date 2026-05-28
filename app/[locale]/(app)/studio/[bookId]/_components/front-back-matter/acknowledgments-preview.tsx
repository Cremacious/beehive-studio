'use client'

import { useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { useBookEditor } from '../book-editor-provider'
import type { AcknowledgmentsFields } from '@/lib/front-back-matter/types'
import { SaveStatusBadge, type FormSaveStatus } from './save-status-badge'
import { PageWrapper } from './page-wrapper'

// DP3 Task 3 — WYSIWYG Acknowledgments page.
//
// Display heading "ACKNOWLEDGMENTS" + thin rule + TipTap mini-editor body.
// The mini-editor keeps only paragraph + bold + italic — no headings, lists,
// quotes, code, hr, or hard-break (Chris's call to keep the surface clean).

type Props = {
  itemId: string
  initialFields: Partial<AcknowledgmentsFields>
}

export function AcknowledgmentsPreview({ itemId, initialFields }: Props) {
  const { updateBinderItem } = useBookEditor()
  const [saveStatus, setSaveStatus] = useState<FormSaveStatus>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function schedule(nextText: unknown) {
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      const newContent = {
        subtype: 'acknowledgments' as const,
        fields: { text: nextText } satisfies AcknowledgmentsFields,
      }
      updateBinderItem(itemId, { content: newContent })
      const result = await updateBinderItemAction(itemId, { content: newContent })
      setSaveStatus(result.success ? 'saved' : 'unsaved')
    }, 1500)
  }

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: false,
          bulletList: false,
          orderedList: false,
          listItem: false,
          blockquote: false,
          horizontalRule: false,
          codeBlock: false,
          code: false,
          strike: false,
        }),
        Placeholder.configure({
          placeholder: 'Write your acknowledgments here — thank the people, places, and presses that helped along the way.',
        }),
      ],
      content: (initialFields.text ?? null) as Parameters<typeof useEditor>[0]['content'],
      editorProps: {
        attributes: {
          class: 'ProseMirror bp-body outline-none',
          style: [
            'font-family: var(--font-prose)',
            'font-size: 16px',
            'line-height: 1.78',
            'color: var(--paper-ink-strong)',
            'min-height: 12em',
          ].join('; '),
        },
      },
      onUpdate: ({ editor }) => schedule(editor.getJSON()),
    },
    [itemId],
  )

  return (
    <PageWrapper saveStatusBadge={<SaveStatusBadge status={saveStatus} />}>
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--paper-ink-strong)',
          textAlign: 'center',
          margin: '0 0 12px',
        }}
      >
        Acknowledgments
      </h2>
      <div
        aria-hidden
        style={{
          width: 36,
          height: 1,
          background: 'var(--paper-400)',
          margin: '0 auto 36px',
        }}
      />
      <EditorContent editor={editor} />
    </PageWrapper>
  )
}
