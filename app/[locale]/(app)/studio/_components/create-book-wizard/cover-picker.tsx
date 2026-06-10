'use client'

import { useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { useCloudinaryUpload } from '@/hooks/use-cloudinary-upload'
import { HelperText, RECESSED_INPUT_STYLE, recessBlur, recessFocus } from './wizard-field'

type Props = {
  coverUrl: string | null
  onChange: (next: string | null) => void
}

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp']
const CLOUDINARY_CONFIGURED = !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

function validate(file: File): string | null {
  if (!ALLOWED.includes(file.type)) return 'Only PNG, JPG, and WEBP images are supported.'
  if (file.size > MAX_BYTES) return 'Cover image must be 5 MB or smaller.'
  return null
}

export function CoverPicker({ coverUrl, onChange }: Props) {
  const { upload, uploading } = useCloudinaryUpload('covers')
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [localPreview, setLocalPreview] = useState<string | null>(coverUrl)

  async function handleFile(file: File) {
    const err = validate(file)
    if (err) {
      toast.error(err)
      return
    }
    setLocalPreview(URL.createObjectURL(file))
    if (CLOUDINARY_CONFIGURED) {
      const result = await upload(file)
      if (result) onChange(result.url)
      else toast.error('Upload failed. Try again or paste a URL below.')
    } else {
      const reader = new FileReader()
      reader.onload = () => onChange(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <label
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--canvas-dark-ink-strong)',
          }}
        >
          Cover image
        </label>
        <span
          className="uppercase"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.08em',
            color: 'var(--canvas-dark-ink-muted)',
          }}
        >
          optional
        </span>
      </div>

      <HelperText id="cover-help">
        Drop a file or paste a URL. Don&apos;t worry if you don&apos;t have one. We&apos;ll generate
        a paper-tone placeholder you can swap later.
      </HelperText>

      {localPreview ? (
        <div
          style={{
            aspectRatio: '5 / 7',
            borderRadius: 'var(--r-card)',
            overflow: 'hidden',
            background: 'var(--canvas-dark-100)',
            boxShadow: 'var(--sh-tile)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={localPreview} alt="Cover preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-describedby="cover-help"
          onClick={() => fileRef.current?.click()}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileRef.current?.click()
            }
          }}
          onDragOver={e => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault()
            setDragOver(false)
            const file = e.dataTransfer.files?.[0]
            if (file) handleFile(file)
          }}
          style={{
            aspectRatio: '5 / 7',
            borderRadius: 'var(--r-card)',
            background: dragOver
              ? 'oklch(from var(--brand) l c h / 0.04)'
              : 'var(--canvas-dark-100)',
            border: `1.5px dashed ${dragOver ? 'var(--brand)' : 'oklch(1 0 0 / 0.10)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
        >
          <div className="flex flex-col items-center gap-2 px-3 text-center">
            <div
              className="inline-flex items-center justify-center"
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--r-pill)',
                background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                boxShadow: 'var(--sh-tile)',
                color: 'var(--canvas-dark-ink-strong)',
              }}
            >
              <UploadCloud size={16} />
            </div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--canvas-dark-ink-strong)', margin: 0 }}>
              {uploading ? 'Uploading…' : CLOUDINARY_CONFIGURED ? 'Drag & drop an image' : 'Drop a file to embed locally'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--canvas-dark-ink-muted)', margin: 0 }}>
              or click to browse · PNG, JPG, WEBP · up to 5&nbsp;MB
            </p>
            {!CLOUDINARY_CONFIGURED && (
              <p style={{ fontSize: 10, color: 'var(--canvas-dark-ink-muted)', margin: 0, fontStyle: 'italic' }}>
                (Cloudinary not configured, upload disabled)
              </p>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />

      {localPreview && (
        <button
          type="button"
          onClick={() => {
            setLocalPreview(null)
            onChange(null)
          }}
          style={{
            fontSize: 11,
            color: 'var(--canvas-dark-ink-muted)',
            alignSelf: 'flex-start',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Change image
        </button>
      )}

      <div className="flex items-center gap-2 my-1">
        <div style={{ flex: 1, height: 1, background: 'oklch(1 0 0 / 0.06)' }} />
        <span
          className="uppercase"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.1em',
            color: 'var(--canvas-dark-ink-muted)',
          }}
        >
          or paste a url
        </span>
        <div style={{ flex: 1, height: 1, background: 'oklch(1 0 0 / 0.06)' }} />
      </div>

      <input
        type="url"
        placeholder="https://…"
        value={coverUrl?.startsWith('http') ? coverUrl : ''}
        onChange={e => {
          const v = e.target.value
          onChange(v || null)
          setLocalPreview(v || null)
        }}
        onFocus={recessFocus}
        onBlur={recessBlur}
        style={{
          ...RECESSED_INPUT_STYLE,
          fontFamily: 'var(--font-mono)',
          fontSize: 12.5,
        }}
      />
    </div>
  )
}
