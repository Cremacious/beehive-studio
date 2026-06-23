'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Settings, Info, Lock, X, Plus, Globe, Users, Image as ImageIcon, UploadCloud } from 'lucide-react'
import { updateClubAction, type ClubSummary } from '@/lib/actions/book-clubs.actions'
import { useCloudinaryUpload } from '@/hooks/use-cloudinary-upload'
import { SettingsCard } from './settings-card'

const MAX_DESC = 500
const MAX_TAGS = 6
const COVER_MAX_BYTES = 5 * 1024 * 1024
const COVER_ALLOWED = ['image/png', 'image/jpeg', 'image/webp']
const CLOUDINARY_CONFIGURED = !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

/* ──────────────────── COVER IMAGE ──────────────────── */

export function CoverImageSection({
  clubId,
  initialCoverImageUrl,
}: {
  clubId: string
  initialCoverImageUrl: string | null
}) {
  const router = useRouter()
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(initialCoverImageUrl)
  const [savedCoverImageUrl, setSavedCoverImageUrl] = useState<string | null>(initialCoverImageUrl)
  const [pending, startSave] = useTransition()
  const { upload: uploadCover, uploading: uploadingCover } = useCloudinaryUpload('clubs')
  const fileRef = useRef<HTMLInputElement>(null)
  const isDirty = coverImageUrl !== savedCoverImageUrl

  async function handleFile(file: File) {
    if (!COVER_ALLOWED.includes(file.type)) {
      toast.error('Only PNG, JPG, and WEBP images are supported.')
      return
    }
    if (file.size > COVER_MAX_BYTES) {
      toast.error('Cover must be 5 MB or smaller.')
      return
    }
    if (!CLOUDINARY_CONFIGURED) {
      toast.error('Image upload is not configured.')
      return
    }
    const result = await uploadCover(file)
    if (result) setCoverImageUrl(result.url)
    else toast.error('Upload failed. Try again.')
  }

  function save() {
    startSave(async () => {
      const result = await updateClubAction({ clubId, coverImageUrl })
      if (!result.success) {
        toast.error('Could not save cover image')
        return
      }
      toast.success('Cover image saved')
      setSavedCoverImageUrl(coverImageUrl)
      router.refresh()
    })
  }

  return (
    <SettingsCard
      title="Cover image"
      icon={<ImageIcon size={16} />}
      description="Shown on club cards across Discover and Clubs hub. Recommended 1200x600 or wider."
    >
      {coverImageUrl ? (
        <div
          style={{
            position: 'relative',
            aspectRatio: '16 / 8',
            borderRadius: 'var(--r-row)',
            overflow: 'hidden',
            background: `url(${coverImageUrl}) center/cover`,
            border: 'var(--br-card)',
          }}
        >
          <button
            type="button"
            onClick={() => setCoverImageUrl(null)}
            disabled={uploadingCover || pending}
            aria-label="Remove cover image"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 9px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              background: 'rgba(0,0,0,0.55)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              backdropFilter: 'blur(6px)',
            }}
          >
            <X size={12} aria-hidden="true" /> Remove
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploadingCover || pending}
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              background: 'rgba(0,0,0,0.55)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              backdropFilter: 'blur(6px)',
            }}
          >
            <UploadCloud size={12} aria-hidden="true" />
            {uploadingCover ? 'Uploading…' : 'Replace'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploadingCover || pending}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            padding: '28px 16px',
            background: 'var(--canvas-dark-100)',
            boxShadow: 'var(--sh-inset)',
            border: '1.5px dashed rgba(255,255,255,0.10)',
            borderRadius: 'var(--r-row)',
            color: 'var(--canvas-dark-ink-muted)',
            fontSize: 12,
            cursor: uploadingCover || pending ? 'wait' : 'pointer',
            opacity: uploadingCover || pending ? 0.6 : 1,
          }}
        >
          <UploadCloud size={20} aria-hidden="true" />
          {uploadingCover ? 'Uploading…' : 'Upload cover image'}
          <span style={{ fontSize: 10, color: 'var(--canvas-dark-ink-faint)' }}>
            PNG, JPG, or WEBP up to 5 MB.
          </span>
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          if (fileRef.current) fileRef.current.value = ''
        }}
      />

      {isDirty && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, gap: 8 }}>
          <button
            type="button"
            onClick={() => setCoverImageUrl(savedCoverImageUrl)}
            disabled={pending || uploadingCover}
            style={ghostBtn}
          >
            Discard
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending || uploadingCover}
            style={brandBtn(pending)}
          >
            {pending ? 'Saving…' : 'Save cover'}
          </button>
        </div>
      )}
    </SettingsCard>
  )
}

/* ──────────────────── DETAILS (name only) ──────────────────── */

export function DetailsSection({
  clubId,
  initialName,
}: {
  clubId: string
  initialName: string
}) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [savedName, setSavedName] = useState(initialName)
  const [pending, startSave] = useTransition()
  const isDirty = name.trim() !== savedName.trim()

  function save() {
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      toast.error('Name must be at least 2 characters')
      return
    }
    startSave(async () => {
      const result = await updateClubAction({ clubId, name: trimmed })
      if (!result.success) {
        toast.error('Could not save name')
        return
      }
      toast.success('Name saved')
      setSavedName(trimmed)
      router.refresh()
    })
  }

  return (
    <SettingsCard
      title="Details"
      icon={<Settings size={16} />}
      description="The name shown across the app."
    >
      <label style={fieldLabelStyle}>Club name</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        style={inputStyle}
      />
      {isDirty && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, gap: 8 }}>
          <button
            type="button"
            onClick={() => setName(savedName)}
            disabled={pending}
            style={ghostBtn}
          >
            Discard
          </button>
          <button type="button" onClick={save} disabled={pending} style={brandBtn(pending)}>
            {pending ? 'Saving…' : 'Save name'}
          </button>
        </div>
      )}
    </SettingsCard>
  )
}

/* ──────────────────── ABOUT (description + tags) ──────────────────── */

export function AboutSection({
  clubId,
  initialDescription,
  initialTags,
}: {
  clubId: string
  initialDescription: string | null
  initialTags: string[] | null
}) {
  const router = useRouter()
  const [description, setDescription] = useState(initialDescription ?? '')
  const [tags, setTags] = useState<string[]>(initialTags ?? [])
  const [tagDraft, setTagDraft] = useState('')
  const [savedDescription, setSavedDescription] = useState(initialDescription ?? '')
  const [savedTags, setSavedTags] = useState<string[]>(initialTags ?? [])
  const [pending, startSave] = useTransition()

  const isDirty =
    description.trim() !== savedDescription.trim() ||
    tags.length !== savedTags.length ||
    tags.some((t, i) => t !== savedTags[i])

  function addTag() {
    const t = tagDraft.trim().toLowerCase().replace(/\s+/g, '-')
    if (!t) return
    if (tags.includes(t)) {
      toast.error('Tag already added')
      return
    }
    if (tags.length >= MAX_TAGS) {
      toast.error(`Max ${MAX_TAGS} tags`)
      return
    }
    setTags((prev) => [...prev, t])
    setTagDraft('')
  }

  function removeTag(t: string) {
    setTags((prev) => prev.filter((x) => x !== t))
  }

  function save() {
    startSave(async () => {
      const result = await updateClubAction({
        clubId,
        description: description.trim() || null,
        tags,
      })
      if (!result.success) {
        toast.error('Could not save about')
        return
      }
      toast.success('About saved')
      setSavedDescription(description.trim())
      setSavedTags(tags)
      router.refresh()
    })
  }

  function discard() {
    setDescription(savedDescription)
    setTags(savedTags)
  }

  return (
    <SettingsCard
      title="About this club"
      icon={<Info size={16} />}
      description="Description and tags. Shown in the sidebar on the club page."
    >
      <label style={fieldLabelStyle}>Description</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={MAX_DESC}
        rows={4}
        style={{ ...inputStyle, resize: 'vertical', minHeight: 96 }}
      />
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--canvas-dark-ink-muted)',
          margin: '4px 0 14px',
          textAlign: 'right',
        }}
      >
        {description.length} / {MAX_DESC}
      </p>

      <label style={fieldLabelStyle}>Tags</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
        {tags.map((t) => (
          <span
            key={t}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 4px 3px 10px',
              background: 'var(--canvas-dark-350)',
              borderRadius: 999,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--canvas-dark-ink)',
            }}
          >
            {t}
            <button
              type="button"
              onClick={() => removeTag(t)}
              aria-label={`Remove tag ${t}`}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--canvas-dark-ink-muted)',
                cursor: 'pointer',
                padding: '0 2px',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        {tags.length < MAX_TAGS && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <input
              type="text"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTag()
                }
              }}
              placeholder="+ tag"
              maxLength={24}
              style={{
                background: 'transparent',
                border: '1px dashed rgba(255,195,0,0.30)',
                borderRadius: 999,
                padding: '3px 10px',
                color: 'var(--brand)',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                width: 80,
                outline: 'none',
              }}
            />
            {tagDraft && (
              <button
                type="button"
                onClick={addTag}
                style={{
                  background: 'var(--brand)',
                  color: 'var(--brand-ink)',
                  border: 'none',
                  borderRadius: 999,
                  padding: '3px 6px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                <Plus size={11} />
              </button>
            )}
          </div>
        )}
      </div>
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--canvas-dark-ink-muted)',
          margin: 0,
        }}
      >
        {tags.length} / {MAX_TAGS}
      </p>

      {isDirty && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14, gap: 8 }}>
          <button type="button" onClick={discard} disabled={pending} style={ghostBtn}>
            Discard
          </button>
          <button type="button" onClick={save} disabled={pending} style={brandBtn(pending)}>
            {pending ? 'Saving…' : 'Save about'}
          </button>
        </div>
      )}
    </SettingsCard>
  )
}

/* ──────────────────── PRIVACY (visibility + openJoin + discoverable) ──────────────────── */

type Visibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE'

export function PrivacySection({
  clubId,
  initialVisibility,
  initialOpenJoin,
  initialDiscoverable,
}: {
  clubId: string
  initialVisibility: Visibility
  initialOpenJoin: boolean
  initialDiscoverable: boolean
}) {
  const router = useRouter()
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility)
  const [openJoin, setOpenJoin] = useState(initialOpenJoin)
  const [discoverable, setDiscoverable] = useState(initialDiscoverable)
  const [saved, setSaved] = useState({
    visibility: initialVisibility,
    openJoin: initialOpenJoin,
    discoverable: initialDiscoverable,
  })
  const [pending, startSave] = useTransition()

  const isDirty =
    visibility !== saved.visibility ||
    openJoin !== saved.openJoin ||
    discoverable !== saved.discoverable

  function save() {
    startSave(async () => {
      const result = await updateClubAction({
        clubId,
        visibility,
        openJoin,
        discoverable,
      })
      if (!result.success) {
        toast.error('Could not save privacy')
        return
      }
      toast.success('Privacy saved')
      setSaved({ visibility, openJoin, discoverable })
      router.refresh()
    })
  }

  return (
    <SettingsCard
      title="Privacy &amp; joining"
      icon={<Lock size={16} />}
      description="Who can see this club and how new members get in."
    >
      <label style={fieldLabelStyle}>Visibility</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {(
          [
            { key: 'PUBLIC', label: 'Public', icon: <Globe size={14} />, sub: 'Anyone can see' },
            { key: 'FRIENDS', label: 'Friends', icon: <Users size={14} />, sub: 'Friends only' },
            { key: 'PRIVATE', label: 'Private', icon: <Lock size={14} />, sub: 'Invite only' },
          ] as const
        ).map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => {
              setVisibility(opt.key)
              if (opt.key !== 'PUBLIC') setDiscoverable(false)
            }}
            style={{
              background:
                visibility === opt.key
                  ? 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))'
                  : 'var(--canvas-dark-100)',
              border:
                visibility === opt.key
                  ? '1px solid var(--brand)'
                  : '1px solid rgba(255,255,255,0.06)',
              boxShadow:
                visibility === opt.key ? 'var(--sh-tile)' : 'var(--sh-inset)',
              borderRadius: 'var(--r-row)',
              padding: '12px 10px',
              color: visibility === opt.key ? 'var(--brand)' : 'var(--canvas-dark-ink)',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.12s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 5 }}>
              {opt.icon}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13 }}>
              {opt.label}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--canvas-dark-ink-muted)',
                marginTop: 3,
              }}
            >
              {opt.sub}
            </div>
          </button>
        ))}
      </div>

      <ToggleRow
        label="Open join"
        sub="Anyone meeting visibility can join instantly. Off requires approval."
        on={openJoin}
        onChange={setOpenJoin}
      />
      <ToggleRow
        label="Discoverable"
        sub={
          visibility === 'PUBLIC'
            ? 'Appear in club discovery and search.'
            : 'Only available when visibility is Public.'
        }
        on={discoverable}
        onChange={setDiscoverable}
        disabled={visibility !== 'PUBLIC'}
      />

      {isDirty && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14, gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              setVisibility(saved.visibility)
              setOpenJoin(saved.openJoin)
              setDiscoverable(saved.discoverable)
            }}
            disabled={pending}
            style={ghostBtn}
          >
            Discard
          </button>
          <button type="button" onClick={save} disabled={pending} style={brandBtn(pending)}>
            {pending ? 'Saving…' : 'Save privacy'}
          </button>
        </div>
      )}
    </SettingsCard>
  )
}

function ToggleRow({
  label,
  sub,
  on,
  onChange,
  disabled,
}: {
  label: string
  sub: string
  on: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 0',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{ flex: 1, paddingRight: 12 }}>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 13,
            color: 'var(--canvas-dark-ink-strong)',
          }}
        >
          {label}
        </p>
        <p
          style={{
            margin: '2px 0 0',
            fontSize: 11,
            color: 'var(--canvas-dark-ink-muted)',
          }}
        >
          {sub}
        </p>
      </div>
      <button
        type="button"
        onClick={() => !disabled && onChange(!on)}
        disabled={disabled}
        aria-pressed={on}
        style={{
          width: 40,
          height: 22,
          borderRadius: 999,
          background: on ? 'var(--brand)' : 'var(--canvas-dark-350)',
          border: '1px solid rgba(255,255,255,0.06)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          position: 'relative',
          flexShrink: 0,
          padding: 0,
          transition: 'background 0.12s',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: on ? 20 : 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: on ? 'var(--brand-ink)' : 'var(--canvas-dark-ink-muted)',
            transition: 'left 0.15s',
          }}
        />
      </button>
    </div>
  )
}

/* ──────────────────── Shared styles ──────────────────── */

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--canvas-dark-ink-muted)',
  margin: '0 0 6px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--canvas-dark-100)',
  boxShadow: 'var(--sh-inset)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: 'var(--r-row)',
  padding: '10px 12px',
  color: 'var(--canvas-dark-ink-strong)',
  fontSize: 14,
  fontFamily: 'inherit',
  lineHeight: 1.5,
  outline: 'none',
  boxSizing: 'border-box',
}

const ghostBtn: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.10)',
  color: 'var(--canvas-dark-ink-muted)',
  borderRadius: 999,
  padding: '7px 14px',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontWeight: 600,
  cursor: 'pointer',
}

function brandBtn(pending: boolean): React.CSSProperties {
  return {
    background: 'var(--brand)',
    color: 'var(--brand-ink)',
    border: 'none',
    borderRadius: 999,
    padding: '7px 16px',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontWeight: 700,
    cursor: pending ? 'wait' : 'pointer',
    opacity: pending ? 0.6 : 1,
  }
}

/* ──────────────────── DANGER ZONE ──────────────────── */

export function DangerSection({
  club,
  locale,
}: {
  club: ClubSummary
  locale: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startDel] = useTransition()

  function doDelete() {
    startDel(async () => {
      const { deleteClubAction } = await import('@/lib/actions/book-clubs.actions')
      const r = await deleteClubAction({ clubId: club.id })
      if (!r.success) {
        toast.error('Could not delete club')
        return
      }
      toast.success(`Deleted "${club.name}"`)
      router.push(`/${locale}/community/clubs`)
      router.refresh()
    })
  }

  return (
    <SettingsCard
      title="Delete club"
      variant="danger"
      description="Permanently removes the club, its discussions, schedule, book queue, and all membership records. This cannot be undone."
    >
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            ...ghostBtn,
            border: '1px solid oklch(0.55 0.18 25)',
            color: 'oklch(0.75 0.15 25)',
          }}
        >
          Delete this club
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'oklch(0.75 0.15 25)', flex: 1 }}>
            Type <strong>{club.name}</strong> to confirm.
          </span>
          <DeleteConfirmInput clubName={club.name} onConfirm={doDelete} pending={pending} />
          <button type="button" onClick={() => setOpen(false)} disabled={pending} style={ghostBtn}>
            Cancel
          </button>
        </div>
      )}
    </SettingsCard>
  )
}

function DeleteConfirmInput({
  clubName,
  onConfirm,
  pending,
}: {
  clubName: string
  onConfirm: () => void
  pending: boolean
}) {
  const [value, setValue] = useState('')
  const matches = value.trim() === clubName.trim()
  return (
    <>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={clubName}
        style={{
          ...inputStyle,
          flex: 1,
          maxWidth: 200,
          fontSize: 12,
          padding: '6px 10px',
        }}
      />
      <button
        type="button"
        onClick={onConfirm}
        disabled={!matches || pending}
        style={{
          background: matches ? 'oklch(0.55 0.18 25)' : 'var(--canvas-dark-350)',
          color: matches ? 'white' : 'var(--canvas-dark-ink-muted)',
          border: 'none',
          borderRadius: 999,
          padding: '7px 14px',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontWeight: 700,
          cursor: matches && !pending ? 'pointer' : 'not-allowed',
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? 'Deleting…' : 'Delete'}
      </button>
    </>
  )
}
