'use client'

import { useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { useBookEditor } from '../book-editor-provider'
import type { AboutAuthorFields } from '@/lib/front-back-matter/types'
import { SaveStatusBadge, type FormSaveStatus } from './save-status-badge'
import { PageWrapper } from './page-wrapper'

// DP3 Task 3 — WYSIWYG About-the-Author page.
//
// Avatar (TODO(avatar-upload): same Cloudinary upload as
// useCloudinaryUpload('author-photos') used by the old about-author-form;
// reinstate once Task-3 visual port is shipped. Placeholder initials only
// for now per plan §Step 7 — matches Task 2 character avatar pattern.) +
// heading + TipTap mini-editor for bio (paragraph + bold + italic only) +
// optional links list.

type Props = {
  itemId: string
  initialFields: Partial<AboutAuthorFields>
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '–'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

export function AboutAuthorPreview({ itemId, initialFields }: Props) {
  const { bookTitle, updateBinderItem } = useBookEditor()
  const fieldsRef = useRef<AboutAuthorFields>({
    bio: initialFields.bio ?? null,
    photoUrl: initialFields.photoUrl,
    links: initialFields.links ?? [],
  })
  const [links, setLinks] = useState<Array<{ label: string; url: string }>>(
    initialFields.links ?? [],
  )
  const [saveStatus, setSaveStatus] = useState<FormSaveStatus>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function schedule(next: AboutAuthorFields) {
    fieldsRef.current = next
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      const newContent = { subtype: 'about_author' as const, fields: next }
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
          placeholder: 'Write a short author bio: who you are, what you write, and anything readers should know.',
        }),
      ],
      content: (initialFields.bio ?? null) as Parameters<typeof useEditor>[0]['content'],
      editorProps: {
        attributes: {
          class: 'ProseMirror bp-body outline-none',
          style: [
            'font-family: var(--font-prose)',
            'font-size: 16px',
            'line-height: 1.78',
            'color: var(--paper-ink-strong)',
            'min-height: 8em',
          ].join('; '),
        },
      },
      onUpdate: ({ editor }) => {
        schedule({ ...fieldsRef.current, bio: editor.getJSON() })
      },
    },
    [itemId],
  )

  function updateLink(index: number, key: 'label' | 'url', value: string) {
    const next = [...links]
    next[index] = { ...next[index]!, [key]: value }
    setLinks(next)
    schedule({ ...fieldsRef.current, links: next })
  }

  function addLink() {
    const next = [...links, { label: '', url: '' }]
    setLinks(next)
    schedule({ ...fieldsRef.current, links: next })
  }

  function removeLink(idx: number) {
    const next = links.filter((_, i) => i !== idx)
    setLinks(next)
    schedule({ ...fieldsRef.current, links: next })
  }

  const initials = getInitials(bookTitle)
  const hasPhoto = !!fieldsRef.current.photoUrl

  return (
    <PageWrapper saveStatusBadge={<SaveStatusBadge status={saveStatus} />}>
      {/* Avatar — placeholder initials. */}
      <div
        aria-label="Author photo (placeholder initials)"
        style={{
          width: 132,
          height: 132,
          borderRadius: '50%',
          margin: '0 auto 24px',
          background: hasPhoto
            ? `center / cover no-repeat url(${JSON.stringify(fieldsRef.current.photoUrl)})`
            : 'linear-gradient(135deg, oklch(0.78 0.05 60), oklch(0.62 0.08 35))',
          border: '4px solid var(--paper-50)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 2px 6px rgba(60,40,20,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 40,
          color: 'var(--paper-100)',
          letterSpacing: '-0.03em',
        }}
      >
        {hasPhoto ? null : initials}
      </div>

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
        About the Author
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

      {/* Links — optional list of label/url pairs. Inline editable. */}
      <div
        style={{
          marginTop: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          alignItems: 'center',
        }}
      >
        {links.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: 16,
              justifyContent: 'center',
              flexWrap: 'wrap',
              fontFamily: 'var(--font-mono)',
              fontSize: 11.5,
              letterSpacing: '0.04em',
              color: 'var(--paper-ink-muted)',
            }}
          >
            {links.map((link, i) => (
              <div
                key={i}
                className="bp-field"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '2px 6px',
                }}
              >
                <input
                  value={link.label}
                  onChange={e => updateLink(i, 'label', e.target.value)}
                  placeholder="label"
                  style={{
                    width: 80,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    color: 'var(--paper-ink-strong)',
                  }}
                />
                <span style={{ opacity: 0.5 }}>·</span>
                <input
                  value={link.url}
                  onChange={e => updateLink(i, 'url', e.target.value)}
                  placeholder="https://"
                  style={{
                    width: 160,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    color: 'var(--paper-ink-muted)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => removeLink(i)}
                  aria-label="Remove link"
                  style={{
                    background: 'transparent',
                    border: 0,
                    cursor: 'pointer',
                    color: 'var(--paper-ink-muted)',
                    padding: 0,
                    marginLeft: 4,
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={addLink}
          style={{
            background: 'transparent',
            border: '1px dashed var(--paper-400)',
            borderRadius: 999,
            padding: '4px 12px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--paper-ink-muted)',
            cursor: 'pointer',
          }}
        >
          + Add link
        </button>
      </div>
    </PageWrapper>
  )
}
