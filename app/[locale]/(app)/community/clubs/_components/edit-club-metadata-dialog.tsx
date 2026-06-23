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
import {
  updateClubAction,
  type ClubSummary,
} from '@/lib/actions/book-clubs.actions'
import { TagInput } from '@/app/[locale]/(app)/community/reading-lists/_components/tag-input'
import { MentionableTextarea } from '@/components/mentions/mentionable-textarea'
import { useCloudinaryUpload } from '@/hooks/use-cloudinary-upload'
import { validateImageFile } from '@/lib/upload/validate-image'
import { optimizeCloudinaryUrl, COVER_TRANSFORMS } from '@/lib/upload/cloudinary-url'

const CLOUDINARY_CONFIGURED = !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

type Visibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE'

type Props = {
  initialClub: ClubSummary
  open: boolean
  onOpenChange: (open: boolean) => void
}

const inputStyle = {
  background: '#1E1E1E',
  boxShadow: 'var(--sh-inset)',
  color: 'var(--canvas-dark-ink)',
} as const

const labelClass = 'text-[10px] font-mono uppercase tracking-[0.14em]'
const labelStyle = { color: 'var(--canvas-dark-ink-muted)' } as const

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        style={{
          width: 4, height: 4, borderRadius: '50%',
          background: 'var(--brand)', display: 'inline-block', flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--brand)',
        }}
      >
        {label}
      </span>
      <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
    </div>
  )
}

export function EditClubMetadataDialog({ initialClub, open, onOpenChange }: Props) {
  const [name, setName] = useState(initialClub.name)
  const [description, setDescription] = useState(initialClub.description ?? '')
  const [rules, setRules] = useState(initialClub.rules ?? '')
  const [tags, setTags] = useState<string[]>(initialClub.tags ?? [])
  const [visibility, setVisibility] = useState<Visibility>(initialClub.visibility as Visibility)
  const [discoverable, setDiscoverable] = useState(initialClub.discoverable)
  const [openJoin, setOpenJoin] = useState(initialClub.openJoin)
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(initialClub.coverImageUrl)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const { upload: uploadCover, uploading: uploadingCover } = useCloudinaryUpload('clubs')
  const coverFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName(initialClub.name)
      setDescription(initialClub.description ?? '')
      setRules(initialClub.rules ?? '')
      setTags(initialClub.tags ?? [])
      setVisibility(initialClub.visibility as Visibility)
      setDiscoverable(initialClub.discoverable)
      setOpenJoin(initialClub.openJoin)
      setCoverImageUrl(initialClub.coverImageUrl)
    }
  }, [open, initialClub])

  useEffect(() => {
    if (visibility !== 'PUBLIC') setDiscoverable(false)
  }, [visibility])

  async function handleCoverFile(file: File) {
    const err = validateImageFile(file, { label: 'Cover' })
    if (err) {
      toast.error(err)
      return
    }
    if (!CLOUDINARY_CONFIGURED) {
      toast.error('Image upload is not configured.')
      return
    }
    const result = await uploadCover(file)
    if (result.url) setCoverImageUrl(result.url)
    else toast.error(`Upload failed: ${result.error}`)
  }

  const submit = () => {
    if (!name.trim()) return
    startTransition(async () => {
      const result = await updateClubAction({
        clubId: initialClub.id,
        name: name.trim(),
        description: description.trim() ? description.trim() : null,
        rules: rules.trim() ? rules.trim() : null,
        tags,
        visibility,
        discoverable,
        openJoin,
        coverImageUrl,
      })
      if (result.success) {
        toast.success('Club updated')
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(`Could not update club (${result.error})`)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-7 gap-6 dialog-ios">
        <DialogHeader>
          <DialogTitle
            className="font-display"
            style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--canvas-dark-ink-strong)' }}
          >
            Edit club
          </DialogTitle>
          <p className="text-[13px] mt-1" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
            Changes are visible to anyone who can see this club.
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-4 max-h-[62vh] overflow-y-auto pr-1 -mr-1">
          <SectionDivider label="Identity" />

          {/* Cover image */}
          <div className="flex flex-col gap-2">
            <label className={labelClass} style={labelStyle}>
              Cover image
              <span className="ml-2 normal-case tracking-normal" style={{ color: 'var(--canvas-dark-ink-faint)' }}>
                optional
              </span>
            </label>
            {coverImageUrl ? (
              <div
                className="relative rounded-[var(--r-row)] overflow-hidden"
                style={{
                  aspectRatio: '16/8',
                  background: `url(${optimizeCloudinaryUrl(coverImageUrl, COVER_TRANSFORMS)}) center/cover`,
                  border: 'var(--br-card)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setCoverImageUrl(null)}
                  className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-[var(--r-pill)] text-[11px] font-medium"
                  style={{ background: 'rgba(0,0,0,0.55)', color: 'white', backdropFilter: 'blur(6px)' }}
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
                <span className="text-[10px]" style={{ color: 'var(--canvas-dark-ink-faint)' }}>
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
            <label htmlFor="ec-name" className={labelClass} style={labelStyle}>
              Name <span style={{ color: 'var(--brand)' }}>*</span>
            </label>
            <input
              id="ec-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 100))}
              maxLength={100}
              autoFocus
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
              <span className="ml-2 normal-case tracking-normal" style={{ color: 'var(--canvas-dark-ink-faint)' }}>
                optional
              </span>
            </label>
            <MentionableTextarea
              value={rules}
              onChange={(next) => setRules(next.slice(0, 2000))}
              maxLength={2000}
              rows={3}
              placeholder="House rules, code of conduct…"
              className="w-full px-3.5 py-2.5 rounded-[var(--r-row)] text-[14px] resize-none outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)]"
              style={inputStyle}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className={labelClass} style={labelStyle}>
              Tags
              <span className="ml-2 normal-case tracking-normal" style={{ color: 'var(--canvas-dark-ink-faint)' }}>
                up to 5
              </span>
            </label>
            <TagInput value={tags} onChange={setTags} max={5} maxChars={20} />
          </div>

          <SectionDivider label="Sharing" />

          <div className="flex flex-col gap-2">
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
            className="flex items-center gap-2.5 text-[13px] py-2.5 px-3 rounded-[var(--r-row)] cursor-pointer select-none"
            style={{ background: 'oklch(1 0 0 / 0.025)', border: 'var(--br-card)' }}
          >
            <input
              type="checkbox"
              checked={discoverable}
              disabled={visibility !== 'PUBLIC'}
              onChange={(e) => setDiscoverable(e.target.checked)}
              className="h-4 w-4 accent-[var(--brand)] disabled:opacity-40"
            />
            <span style={{ color: 'var(--canvas-dark-ink)' }}>Show in Discover</span>
            {visibility !== 'PUBLIC' && (
              <span className="text-[11px] ml-auto" style={{ color: 'var(--canvas-dark-ink-faint)' }}>
                public clubs only
              </span>
            )}
          </label>

          <label
            className="flex items-start gap-2.5 text-[13px] py-2.5 px-3 rounded-[var(--r-row)] cursor-pointer select-none"
            style={{ background: 'oklch(1 0 0 / 0.025)', border: 'var(--br-card)' }}
          >
            <input
              type="checkbox"
              checked={openJoin}
              onChange={(e) => setOpenJoin(e.target.checked)}
              className="h-4 w-4 accent-[var(--brand)] mt-0.5"
            />
            <span className="flex-1">
              <span className="block" style={{ color: 'var(--canvas-dark-ink)' }}>Open join</span>
              <span className="block text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                Anyone who can see this club can join with one click. Otherwise new members request to join and an owner or moderator approves.
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
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
