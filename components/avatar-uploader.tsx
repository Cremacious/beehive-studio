'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCloudinaryUpload } from '@/hooks/use-cloudinary-upload'
import { updateAvatarAction, deleteAvatarAction } from '@/lib/actions/avatar.actions'
import { validateImageFile } from '@/lib/upload/validate-image'
import { optimizeCloudinaryUrl, AVATAR_TRANSFORMS } from '@/lib/upload/cloudinary-url'

type Props = {
  userId: string
  displayName: string | null
  username: string
  currentAvatarUrl: string | null
}

const CLOUDINARY_CONFIGURED = !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

function pickAccent(seed: string): string {
  const accents = ['a-mint', 'a-blue', 'a-coral', 'a-lilac', 'a-slate'] as const
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return accents[Math.abs(hash) % accents.length]
}

function initialsOf(displayName: string | null, username: string): string {
  const src = (displayName ?? username).trim()
  if (!src) return '?'
  const parts = src.split(/\s+/).slice(0, 2)
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || src.charAt(0).toUpperCase()
}

export function AvatarUploader({ userId, displayName, username, currentAvatarUrl }: Props) {
  const { upload, uploading } = useCloudinaryUpload('avatars')
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(currentAvatarUrl)
  const [isPending, startTransition] = useTransition()

  const accent = pickAccent(userId)
  const initials = initialsOf(displayName, username)
  const busy = uploading || isPending

  async function handleFile(file: File) {
    const err = validateImageFile(file)
    if (err) {
      toast.error(err)
      return
    }

    // Immediate local preview before upload completes
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)

    let finalUrl: string | null = null

    if (CLOUDINARY_CONFIGURED) {
      const result = await upload(file)
      if (!result.url) {
        toast.error(`Upload failed: ${result.error}`)
        setPreview(currentAvatarUrl)
        return
      }
      finalUrl = result.url
    } else {
      // Dev fallback: embed as data URL
      finalUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })
    }

    startTransition(async () => {
      const res = await updateAvatarAction(finalUrl)
      if (!res.success) {
        toast.error('Failed to save avatar. Please try again.')
        setPreview(currentAvatarUrl)
      } else {
        setPreview(finalUrl)
        toast.success('Avatar updated.')
      }
    })
  }

  function handleRemove() {
    startTransition(async () => {
      const res = await deleteAvatarAction()
      if (!res.success) {
        toast.error('Failed to remove avatar. Please try again.')
      } else {
        setPreview(null)
        toast.success('Avatar removed.')
      }
    })
  }

  return (
    <div className="flex items-center gap-5">
      {/* Avatar circle with camera overlay trigger */}
      <div className="relative" style={{ width: 80, height: 80 }}>
        <button
          type="button"
          onClick={() => !busy && fileRef.current?.click()}
          disabled={busy}
          aria-label="Upload new avatar"
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: busy ? 'wait' : 'pointer',
            position: 'relative',
            border: 'none',
            padding: 0,
          }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.startsWith('blob:') || preview.startsWith('data:') ? preview : optimizeCloudinaryUrl(preview, AVATAR_TRANSFORMS)}
              alt="Your avatar"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span
              className={`avatar s80 ${accent}`}
              style={{ width: '100%', height: '100%', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {initials}
            </span>
          )}

          {/* Camera icon overlay */}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: busy
                ? 'oklch(0 0 0 / 0.55)'
                : 'oklch(0 0 0 / 0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 150ms ease',
              color: '#fff',
            }}
            className="hover-overlay"
          >
            {busy ? (
              <span
                style={{
                  width: 18,
                  height: 18,
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                  display: 'block',
                }}
              />
            ) : (
              <Camera size={20} style={{ opacity: 0 }} className="camera-icon" />
            )}
          </span>
        </button>

        <style>{`
          .hover-overlay:hover .camera-icon,
          button:hover .hover-overlay .camera-icon { opacity: 1 !important; }
          button:hover .hover-overlay { background: oklch(0 0 0 / 0.45) !important; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>

      {/* Text + actions */}
      <div className="flex flex-col gap-2">
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--canvas-dark-ink-strong)',
            margin: 0,
          }}
        >
          Profile picture
        </p>
        <p
          style={{
            fontSize: 12,
            color: 'var(--canvas-dark-ink-muted)',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          JPG, PNG or WEBP. Max 5 MB.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => !busy && fileRef.current?.click()}
            disabled={busy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 12px',
              borderRadius: 'var(--r-pill)',
              background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
              boxShadow: 'var(--sh-tile)',
              border: 'none',
              cursor: busy ? 'wait' : 'pointer',
              fontFamily: 'var(--font-display)',
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--canvas-dark-ink-strong)',
              opacity: busy ? 0.6 : 1,
              transition: 'opacity 150ms ease',
            }}
          >
            <Camera size={13} />
            {uploading ? 'Uploading…' : 'Upload photo'}
          </button>

          {preview && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 12px',
                borderRadius: 'var(--r-pill)',
                background: 'oklch(0.62 0.18 25 / 0.12)',
                border: '1px solid oklch(0.62 0.18 25 / 0.25)',
                cursor: busy ? 'wait' : 'pointer',
                fontFamily: 'var(--font-display)',
                fontSize: 12.5,
                fontWeight: 600,
                color: 'oklch(0.72 0.16 25)',
                opacity: busy ? 0.6 : 1,
                transition: 'opacity 150ms ease',
              }}
            >
              <Trash2 size={13} />
              Remove
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}
