'use client'

import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { toast } from 'sonner'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { useBookEditor } from '../book-editor-provider'
import { useCloudinaryUpload } from '@/hooks/use-cloudinary-upload'
import { validateImageFile } from '@/lib/upload/validate-image'
import { optimizeCloudinaryUrl, ABOUT_AUTHOR_TRANSFORMS } from '@/lib/upload/cloudinary-url'
import { deleteCloudinaryAssetAction } from '@/lib/actions/cloudinary-cleanup.actions'
import { toastActionError, toastNetworkError } from '@/lib/errors/notify'
import type { AboutAuthorFields } from '@/lib/front-back-matter/types'
import { SaveStatusBadge, type FormSaveStatus } from './save-status-badge'
import { PageWrapper } from './page-wrapper'

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
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(initialFields.photoUrl)
  const [avatarHovered, setAvatarHovered] = useState(false)
  const [saveStatus, setSaveStatus] = useState<FormSaveStatus>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { upload, uploading } = useCloudinaryUpload('about-author')

  function schedule(next: AboutAuthorFields) {
    fieldsRef.current = next
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      const newContent = { subtype: 'about_author' as const, fields: next }
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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const err = validateImageFile(file, { label: 'Photo' })
    if (err) {
      toast.error(err)
      e.target.value = ''
      return
    }

    const previousPhotoUrl = fieldsRef.current.photoUrl

    if (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) {
      const res = await upload(file)
      if (res.url) {
        setPhotoUrl(res.url)
        schedule({ ...fieldsRef.current, photoUrl: res.url })
        if (previousPhotoUrl) {
          // Best-effort cleanup of the prior Cloudinary asset
          void deleteCloudinaryAssetAction(previousPhotoUrl, 'about-author/').catch(() => {})
        }
      } else {
        toast.error(`Upload failed: ${res.error}`)
      }
    } else {
      // Fallback: embed as data URL when Cloudinary isn't configured
      const fields = fieldsRef.current
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPhotoUrl(reader.result)
          schedule({ ...fields, photoUrl: reader.result })
        }
      }
      reader.readAsDataURL(file)
    }

    e.target.value = ''
  }

  function removePhoto() {
    const previousPhotoUrl = fieldsRef.current.photoUrl
    setPhotoUrl(undefined)
    schedule({ ...fieldsRef.current, photoUrl: undefined })
    if (previousPhotoUrl) {
      // Best-effort cleanup of the prior Cloudinary asset
      void deleteCloudinaryAssetAction(previousPhotoUrl, 'about-author/').catch(() => {})
    }
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
            'font-size: 13px',
            'line-height: 1.72',
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
  const hasPhoto = !!photoUrl

  return (
    <PageWrapper saveStatusBadge={<SaveStatusBadge status={saveStatus} />}>
      {/* Compact section label above the avatar */}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--paper-ink-muted)',
          textAlign: 'center',
          marginBottom: 12,
        }}
      >
        About the Author
      </div>

      {/* Avatar — upload zone with hover overlay */}
      <div style={{ textAlign: 'center' }}>
        <div
          role="button"
          aria-label={hasPhoto ? 'Change author photo' : 'Add author photo'}
          tabIndex={0}
          onMouseEnter={() => setAvatarHovered(true)}
          onMouseLeave={() => setAvatarHovered(false)}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
          style={{
            position: 'relative',
            width: 96,
            height: 96,
            borderRadius: '50%',
            margin: '0 auto',
            cursor: uploading ? 'wait' : 'pointer',
            display: 'inline-block',
          }}
        >
          {/* Circle */}
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              background: hasPhoto && photoUrl
                ? `center / cover no-repeat url(${JSON.stringify(photoUrl.startsWith('data:') ? photoUrl : optimizeCloudinaryUrl(photoUrl, ABOUT_AUTHOR_TRANSFORMS))})`
                : 'linear-gradient(135deg, oklch(0.78 0.05 60), oklch(0.62 0.08 35))',
              border: '3px solid var(--paper-50)',
              boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 2px 6px rgba(60,40,20,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 28,
              color: 'var(--paper-100)',
              letterSpacing: '-0.03em',
              userSelect: 'none',
            }}
          >
            {hasPhoto ? null : (uploading ? '…' : initials)}
          </div>

          {/* Hover overlay */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.45)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              opacity: avatarHovered && !uploading ? 1 : 0,
              transition: 'opacity 0.15s',
              pointerEvents: 'none',
            }}
          >
            <Camera size={18} aria-hidden />
            <span
              style={{
                fontSize: 9,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'white',
              }}
            >
              {hasPhoto ? 'Change' : 'Add photo'}
            </span>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* Change / Remove controls, visible only when a photo is set */}
        {hasPhoto && (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8, marginBottom: 6 }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '3px 10px',
                borderRadius: 999,
                border: '1px solid var(--paper-400)',
                background: 'transparent',
                color: 'var(--paper-ink-muted)',
                cursor: 'pointer',
              }}
            >
              Change
            </button>
            <button
              type="button"
              onClick={removePhoto}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '3px 10px',
                borderRadius: 999,
                border: '1px solid oklch(0.55 0.12 25)',
                background: 'transparent',
                color: 'oklch(0.55 0.12 25)',
                cursor: 'pointer',
              }}
            >
              Remove
            </button>
          </div>
        )}

        {!hasPhoto && <div style={{ marginBottom: 14 }} />}
      </div>

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
