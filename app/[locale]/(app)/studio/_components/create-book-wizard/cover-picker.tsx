'use client'

import { useEffect, useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { validateImageFile } from '@/lib/upload/validate-image'
import { optimizeCloudinaryUrl, BOOK_COVER_TRANSFORMS } from '@/lib/upload/cloudinary-url'
import { HelperText, RECESSED_INPUT_STYLE, recessBlur, recessFocus } from './wizard-field'

/**
 * Wizard cover picker — DEFERRED upload.
 *
 * The selected file is held in parent state as a File. We render a local
 * blob: URL preview during the wizard but DO NOT touch Cloudinary until
 * the user confirms book creation in the final submit step. This avoids
 * orphan assets when the user cancels mid-wizard or swaps the image
 * multiple times.
 *
 * `coverUrl` is used for the "paste a URL" branch only — picking a file
 * sets `coverFile` and clears `coverUrl`, and vice versa.
 */

type Props = {
  coverUrl: string | null
  coverFile: File | null
  onChange: (patch: { coverUrl?: string | null; coverFile?: File | null }) => void
}

export function CoverPicker({ coverUrl, coverFile, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [blobPreview, setBlobPreview] = useState<string | null>(null)

  // Manage blob: URL lifecycle for the local file preview. Revoke the prior
  // URL when the File changes or when the component unmounts so the browser
  // can free the memory.
  useEffect(() => {
    if (!coverFile) {
      setBlobPreview(null)
      return
    }
    const url = URL.createObjectURL(coverFile)
    setBlobPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [coverFile])

  function handleFile(file: File) {
    const err = validateImageFile(file, { label: 'Cover image' })
    if (err) {
      toast.error(err)
      return
    }
    // Defer upload — just stash the File on the parent. Picking a file
    // clears any pasted URL since the two inputs are mutually exclusive.
    onChange({ coverFile: file, coverUrl: null })
  }

  const previewSrc = blobPreview ?? coverUrl
  const hasPreview = !!previewSrc

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

      {hasPreview ? (
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
          <img
            src={
              previewSrc!.startsWith('blob:') || previewSrc!.startsWith('data:')
                ? previewSrc!
                : optimizeCloudinaryUrl(previewSrc!, BOOK_COVER_TRANSFORMS)
            }
            alt="Cover preview"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
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
              Drag & drop an image
            </p>
            <p style={{ fontSize: 11, color: 'var(--canvas-dark-ink-muted)', margin: 0 }}>
              or click to browse · PNG, JPG, WEBP · up to 5&nbsp;MB
            </p>
            <p style={{ fontSize: 10, color: 'var(--canvas-dark-ink-muted)', margin: 0, fontStyle: 'italic' }}>
              Uploaded only when you create the book.
            </p>
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

      {hasPreview && (
        <button
          type="button"
          onClick={() => {
            onChange({ coverFile: null, coverUrl: null })
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
          // Pasting a URL clears any pending file selection.
          onChange({ coverUrl: v || null, coverFile: null })
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
