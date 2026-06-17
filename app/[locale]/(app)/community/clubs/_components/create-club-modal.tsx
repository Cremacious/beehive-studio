'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { UploadCloud, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { VisibilityPicker, PUBLIC_FRIENDS_PRIVATE_OPTIONS } from '@/components/visibility-picker'
import { createClubAction } from '@/lib/actions/book-clubs.actions'
import { TagInput } from '@/app/[locale]/(app)/community/reading-lists/_components/tag-input'
import { MentionableTextarea } from '@/components/mentions/mentionable-textarea'
import { useCloudinaryUpload } from '@/hooks/use-cloudinary-upload'

const COVER_MAX_BYTES = 5 * 1024 * 1024
const COVER_ALLOWED = ['image/png', 'image/jpeg', 'image/webp']
const CLOUDINARY_CONFIGURED = !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

type Visibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE'

type Props = {
  locale: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateClubModal({ locale, open, onOpenChange }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rules, setRules] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC')
  const [discoverable, setDiscoverable] = useState(true)
  const [openJoin, setOpenJoin] = useState(true)
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const { upload: uploadCover, uploading: uploadingCover } =
    useCloudinaryUpload('covers')
  const coverFileRef = useRef<HTMLInputElement>(null)

  // Reset form when closed.
  useEffect(() => {
    if (!open) {
      setName('')
      setDescription('')
      setRules('')
      setTags([])
      setVisibility('PUBLIC')
      setDiscoverable(true)
      setOpenJoin(true)
      setCoverImageUrl(null)
    }
  }, [open])

  async function handleCoverFile(file: File) {
    if (!COVER_ALLOWED.includes(file.type)) {
      toast.error('Only PNG, JPG, and WEBP images are supported.')
      return
    }
    if (file.size > COVER_MAX_BYTES) {
      toast.error('Cover must be 5 MB or smaller.')
      return
    }
    if (!CLOUDINARY_CONFIGURED) {
      toast.error('Image upload is not configured. Skip the cover for now.')
      return
    }
    const result = await uploadCover(file)
    if (result) setCoverImageUrl(result.url)
    else toast.error('Upload failed. Try again.')
  }

  // Force-clear discoverable when visibility leaves PUBLIC (3-layer defense).
  useEffect(() => {
    if (visibility !== 'PUBLIC') setDiscoverable(false)
  }, [visibility])

  const submit = () => {
    if (!name.trim()) return
    startTransition(async () => {
      const result = await createClubAction({
        name: name.trim(),
        description: description.trim() || undefined,
        rules: rules.trim() || undefined,
        tags,
        visibility,
        discoverable,
        openJoin,
        coverImageUrl: coverImageUrl ?? undefined,
      })
      if (result.success) {
        toast.success('Book club created')
        onOpenChange(false)
        router.push(`/${locale}/community/clubs/${result.data.id}`)
      } else {
        toast.error(`Could not create club (${result.error})`)
      }
    })
  }

  const inputStyle = {
    background: '#1E1E1E',
    boxShadow: 'var(--sh-inset)',
    color: 'var(--canvas-dark-ink)',
  } as const

  const labelClass =
    'text-[10px] font-mono uppercase tracking-[0.14em]'
  const labelStyle = { color: 'var(--canvas-dark-ink-muted)' } as const

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-7 gap-6 dialog-ios">
        <DialogHeader>
          <DialogTitle
            className="font-display"
            style={{
              fontSize: '20px',
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: 'var(--canvas-dark-ink-strong)',
            }}
          >
            New book club
          </DialogTitle>
          <p
            className="text-[13px] mt-1"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            Read together. You can change these later.
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-5 max-h-[62vh] overflow-y-auto pr-1 -mr-1">
          {/* Cover image (optional) */}
          <div className="flex flex-col gap-2">
            <label className={labelClass} style={labelStyle}>
              Cover image
              <span
                className="ml-2 normal-case tracking-normal"
                style={{ color: 'var(--canvas-dark-ink-faint)' }}
              >
                optional
              </span>
            </label>
            {coverImageUrl ? (
              <div
                className="relative rounded-[var(--r-row)] overflow-hidden"
                style={{
                  aspectRatio: '16/8',
                  background: `url(${coverImageUrl}) center/cover`,
                  border: 'var(--br-card)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setCoverImageUrl(null)}
                  className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-[var(--r-pill)] text-[11px] font-medium"
                  style={{
                    background: 'rgba(0,0,0,0.55)',
                    color: 'white',
                    backdropFilter: 'blur(6px)',
                  }}
                  aria-label="Remove cover image"
                >
                  <X size={12} aria-hidden="true" /> Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => coverFileRef.current?.click()}
                disabled={uploadingCover}
                className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-row)] text-[12px] py-6 cursor-pointer disabled:opacity-60"
                style={{
                  background: '#1E1E1E',
                  boxShadow: 'var(--sh-inset)',
                  color: 'var(--canvas-dark-ink-muted)',
                  border: '1.5px dashed rgba(255,255,255,0.10)',
                }}
              >
                <UploadCloud size={20} aria-hidden="true" />
                {uploadingCover ? 'Uploading…' : 'Upload cover image'}
                <span
                  className="text-[10px]"
                  style={{ color: 'var(--canvas-dark-ink-faint)' }}
                >
                  PNG, JPG, or WEBP up to 5 MB. Recommended 1200x600 or wider.
                </span>
              </button>
            )}
            <input
              ref={coverFileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleCoverFile(file)
                if (coverFileRef.current) coverFileRef.current.value = ''
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="cc-name" className={labelClass} style={labelStyle}>
              Name <span style={{ color: 'var(--brand)' }}>*</span>
            </label>
            <input
              id="cc-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 100))}
              maxLength={100}
              autoFocus
              placeholder="e.g. The Cozy Fantasy Society"
              className="w-full h-10 px-3.5 rounded-[var(--r-row)] text-[14px] outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)]"
              style={inputStyle}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className={labelClass} style={labelStyle}>
              Description
            </label>
            <MentionableTextarea
              value={description}
              onChange={(next) => setDescription(next.slice(0, 1000))}
              maxLength={1000}
              rows={3}
              placeholder="What's this club about?"
              className="w-full px-3.5 py-2.5 rounded-[var(--r-row)] text-[14px] resize-none outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)]"
              style={inputStyle}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className={labelClass} style={labelStyle}>
              Rules
              <span
                className="ml-2 normal-case tracking-normal"
                style={{ color: 'var(--canvas-dark-ink-faint)' }}
              >
                optional
              </span>
            </label>
            <MentionableTextarea
              value={rules}
              onChange={(next) => setRules(next.slice(0, 2000))}
              maxLength={2000}
              rows={4}
              placeholder="House rules, code of conduct, etc."
              className="w-full px-3.5 py-2.5 rounded-[var(--r-row)] text-[14px] resize-none outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)]"
              style={inputStyle}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className={labelClass} style={labelStyle}>
              Tags
              <span
                className="ml-2 normal-case tracking-normal"
                style={{ color: 'var(--canvas-dark-ink-faint)' }}
              >
                up to 5
              </span>
            </label>
            <TagInput value={tags} onChange={setTags} max={5} maxChars={20} />
          </div>

          <div className="flex flex-col gap-2.5">
            <label className={labelClass} style={labelStyle}>
              Visibility
            </label>
            <VisibilityPicker
              value={visibility}
              onChange={setVisibility}
              options={PUBLIC_FRIENDS_PRIVATE_OPTIONS}
            />
          </div>

          <label
            className="flex items-center gap-2.5 text-[13px] py-2 px-3 rounded-[var(--r-row)] cursor-pointer select-none"
            style={{
              background: 'oklch(1 0 0 / 0.025)',
              border: 'var(--br-card)',
            }}
          >
            <input
              type="checkbox"
              checked={discoverable}
              disabled={visibility !== 'PUBLIC'}
              onChange={(e) => setDiscoverable(e.target.checked)}
              className="h-4 w-4 accent-[var(--brand)] disabled:opacity-40"
            />
            <span style={{ color: 'var(--canvas-dark-ink)' }}>
              Show in Discover
            </span>
            {visibility !== 'PUBLIC' && (
              <span
                className="text-[11px] ml-auto"
                style={{ color: 'var(--canvas-dark-ink-faint)' }}
              >
                public clubs only
              </span>
            )}
          </label>

          <label
            className="flex items-start gap-2.5 text-[13px] py-2.5 px-3 rounded-[var(--r-row)] cursor-pointer select-none"
            style={{
              background: 'oklch(1 0 0 / 0.025)',
              border: 'var(--br-card)',
            }}
          >
            <input
              type="checkbox"
              checked={openJoin}
              onChange={(e) => setOpenJoin(e.target.checked)}
              className="h-4 w-4 accent-[var(--brand)] mt-0.5"
            />
            <span className="flex-1">
              <span
                className="block"
                style={{ color: 'var(--canvas-dark-ink)' }}
              >
                Open join
              </span>
              <span
                className="block text-[11px] mt-0.5 leading-snug"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                Anyone who can see this club can join with one click. Otherwise
                new members request to join and an owner or moderator approves.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter className="dialog-ios-footer">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 rounded-[var(--r-pill)] text-[13px] font-medium transition-colors"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending || !name.trim()}
            className="h-9 px-5 rounded-[var(--r-pill)] text-[13px] font-semibold disabled:opacity-40"
            style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
          >
            {isPending ? 'Creating…' : 'Create club'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
