'use client'

import { useRef, useState } from 'react'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { useCloudinaryUpload } from '@/hooks/use-cloudinary-upload'
import { useBookEditor } from '../book-editor-provider'
import type { AboutAuthorFields } from '@/lib/front-back-matter/types'

const cloudinaryConfigured = !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

type Props = {
  itemId: string
  initialFields: Partial<AboutAuthorFields>
}

export function AboutAuthorForm({ itemId, initialFields }: Props) {
  const { updateBinderItem } = useBookEditor()
  const { upload, uploading } = useCloudinaryUpload('author-photos')
  const [fields, setFields] = useState<AboutAuthorFields>({
    bio: initialFields.bio ?? '',
    photoUrl: initialFields.photoUrl,
    links: initialFields.links ?? [],
  })
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function scheduleSave(next: AboutAuthorFields) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const newContent = { subtype: 'about_author' as const, fields: next }
      updateBinderItem(itemId, { content: newContent })
      await updateBinderItemAction(itemId, { content: newContent })
    }, 2000)
  }

  function patch<K extends keyof AboutAuthorFields>(key: K, value: AboutAuthorFields[K]) {
    const next = { ...fields, [key]: value }
    setFields(next)
    scheduleSave(next)
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !cloudinaryConfigured) return
    const result = await upload(file)
    if (result) patch('photoUrl', result.url)
  }

  function addLink() {
    patch('links', [...(fields.links ?? []), { label: '', url: '' }])
  }

  function updateLink(index: number, key: 'label' | 'url', value: string) {
    const links = [...(fields.links ?? [])]
    links[index] = { ...links[index], [key]: value }
    patch('links', links)
  }

  function removeLink(index: number) {
    const links = [...(fields.links ?? [])]
    links.splice(index, 1)
    patch('links', links)
  }

  const inputClass = 'bg-surface-inset border border-border rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-brand/40 transition-colors'
  const labelClass = 'text-xs text-muted-foreground uppercase tracking-wide font-medium'

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <div className="max-w-2xl mx-auto flex flex-col gap-5">
        <header>
          <h2 className="text-lg font-semibold text-foreground">About the Author</h2>
          <p className="text-xs text-muted-foreground mt-0.5">A short bio with optional photo and links.</p>
        </header>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Bio</span>
          <textarea
            value={fields.bio}
            onChange={e => patch('bio', e.target.value)}
            rows={8}
            className={`${inputClass} resize-y`}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Author photo (optional)</span>
          {cloudinaryConfigured ? (
            <div className="flex items-center gap-4">
              {fields.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fields.photoUrl} alt="Author" className="w-20 h-20 rounded-full object-cover border border-border" />
              ) : (
                <div className="w-20 h-20 rounded-full border border-dashed border-border flex items-center justify-center text-[11px] text-muted-foreground">
                  No photo
                </div>
              )}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="bg-surface-inset border border-border rounded-md px-3 py-1.5 text-xs text-foreground hover:border-brand/40 transition-colors disabled:opacity-50"
                >
                  {uploading ? 'Uploading…' : fields.photoUrl ? 'Replace photo' : 'Upload photo'}
                </button>
                {fields.photoUrl && (
                  <button
                    type="button"
                    onClick={() => patch('photoUrl', undefined)}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors text-left"
                  >
                    Remove photo
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">Photo upload unavailable in this environment.</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className={labelClass}>Links (optional)</span>
          {(fields.links ?? []).map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Label"
                value={link.label}
                onChange={e => updateLink(i, 'label', e.target.value)}
                className={`${inputClass} w-1/3`}
              />
              <input
                type="text"
                placeholder="https://"
                value={link.url}
                onChange={e => updateLink(i, 'url', e.target.value)}
                className={`${inputClass} flex-1`}
              />
              <button
                type="button"
                onClick={() => removeLink(i)}
                aria-label="Remove link"
                className="w-8 h-8 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-brand/40 transition-colors"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addLink}
            className="self-start text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
          >
            + Add link
          </button>
        </div>
      </div>
    </main>
  )
}
