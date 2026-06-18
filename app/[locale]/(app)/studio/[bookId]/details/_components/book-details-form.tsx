'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Globe, Lock, Sparkles, Trash2, Upload, Users, X } from 'lucide-react'
import {
  updateBookDetailsAction,
  type BookDetails,
} from '@/lib/actions/book.actions'
import { SharingControls, type Visibility } from '@/components/book/sharing-controls'
import { DeleteBookButton } from '@/components/book/delete-book-button'
import { useCloudinaryUpload } from '@/hooks/use-cloudinary-upload'
import {
  GENRES,
  GENRE_NAMES,
  CONTENT_WARNINGS,
  TARGET_AUDIENCES,
} from '../../../_components/create-book-wizard/genre-data'
import { PREDEFINED_TAGS } from '../../../_components/create-book-wizard/tags-data'

// ─── Types ────────────────────────────────────────────────────────────────────

type FormState = {
  title: string
  subtitle: string
  synopsis: string
  coverUrl: string | null
  genre: string
  subgenre: string
  tags: string[]
  targetAudience: string
  contentWarnings: string[]
  compTitles: string[]
  language: string
  isSeriesBook: boolean
  seriesName: string
  seriesNumber: string
  visibility: Visibility
  discoverable: boolean
}

const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Portuguese',
  'Italian', 'Japanese', 'Korean', 'Chinese', 'Other',
] as const

function toFormState(initial: BookDetails): FormState {
  return {
    title: initial.title,
    subtitle: initial.subtitle ?? '',
    synopsis: initial.synopsis ?? '',
    coverUrl: initial.coverUrl,
    genre: initial.genre ?? '',
    subgenre: initial.subgenre ?? '',
    tags: initial.tags,
    targetAudience: initial.targetAudience ?? '',
    contentWarnings: initial.contentWarnings,
    compTitles: initial.compTitles.length ? initial.compTitles : [''],
    language: initial.language ?? '',
    isSeriesBook: Boolean(initial.seriesName || initial.seriesNumber),
    seriesName: initial.seriesName ?? '',
    seriesNumber: initial.seriesNumber != null ? String(initial.seriesNumber) : '',
    visibility: initial.visibility,
    discoverable: initial.discoverable,
  }
}

function toggleItem<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]
}

function isClean(a: FormState, b: FormState): boolean {
  if (a.title !== b.title) return false
  if (a.subtitle !== b.subtitle) return false
  if (a.synopsis !== b.synopsis) return false
  if (a.coverUrl !== b.coverUrl) return false
  if (a.genre !== b.genre) return false
  if (a.subgenre !== b.subgenre) return false
  if (a.targetAudience !== b.targetAudience) return false
  if (a.language !== b.language) return false
  if (a.isSeriesBook !== b.isSeriesBook) return false
  if (a.seriesName !== b.seriesName) return false
  if (a.seriesNumber !== b.seriesNumber) return false
  if (a.visibility !== b.visibility) return false
  if (a.discoverable !== b.discoverable) return false
  if (a.tags.join('|') !== b.tags.join('|')) return false
  if (a.contentWarnings.join('|') !== b.contentWarnings.join('|')) return false
  if (a.compTitles.join('|') !== b.compTitles.join('|')) return false
  return true
}

const cloudinaryConfigured = !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

// ─── Shared field styles ──────────────────────────────────────────────────────

const fieldStyle = {
  background: 'var(--canvas-dark-100)',
  boxShadow: 'var(--sh-inset)',
  color: 'var(--canvas-dark-ink)',
  border: 'none',
  borderRadius: 'var(--r-row)',
  width: '100%',
  padding: '10px 14px',
  fontSize: 14,
  outline: 'none',
} as const

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontFamily: 'var(--font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: 'var(--canvas-dark-ink-muted)',
  marginBottom: 6,
  opacity: 0.75,
}

// ─── Panel chrome ─────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
  borderRadius: 'var(--r-card)',
  borderTop: 'var(--br-card)',
  boxShadow: 'var(--sh-card)',
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({ label, active, onClick, disabled = false }: {
  label: string; active: boolean; onClick: () => void; disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 12px',
        height: 28,
        borderRadius: 'var(--r-pill)',
        border: 'none',
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        background: active ? 'var(--brand)' : 'var(--canvas-dark-300)',
        color: active ? 'var(--brand-ink)' : 'var(--canvas-dark-ink-muted)',
        transition: 'background 0.12s, color 0.12s',
      }}
    >
      {label}
    </button>
  )
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ title, badge }: { title: string; badge?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 15,
        fontWeight: 700,
        color: 'var(--brand)',
        letterSpacing: '-0.01em',
        margin: 0,
      }}>
        {title}
      </h2>
      {badge}
      <div style={{ flex: 1, height: 1, background: 'oklch(1 0 0 / 0.06)' }} />
    </div>
  )
}

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
  locale: string
  bookId: string
  initial: BookDetails
  isPremium: boolean
}

// ─── The form ─────────────────────────────────────────────────────────────────

export function BookDetailsForm({ locale, bookId, initial, isPremium }: Props) {
  const router = useRouter()
  const initialState = useMemo(() => toFormState(initial), [initial])
  const [form, setForm] = useState<FormState>(initialState)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  const { upload, uploading } = useCloudinaryUpload('covers')
  const [preview, setPreview] = useState<string | null>(form.coverUrl)
  const fileRef = useRef<HTMLInputElement>(null)
  const [tagInput, setTagInput] = useState('')

  const dirty = !isClean(form, initialState)
  const subgenres = form.genre ? (GENRES[form.genre] ?? []) : []

  function update(patch: Partial<FormState>) {
    setForm(prev => ({ ...prev, ...patch }))
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    if (cloudinaryConfigured) {
      const result = await upload(file)
      if (result) update({ coverUrl: result.url })
    } else {
      // fallback: data URL preview only
      const reader = new FileReader()
      reader.onload = ev => {
        if (typeof ev.target?.result === 'string') update({ coverUrl: ev.target.result })
      }
      reader.readAsDataURL(file)
    }
  }

  function addCustomTag(value: string) {
    const t = value.trim()
    if (!t || form.tags.includes(t) || form.tags.length >= 10) return
    update({ tags: [...form.tags, t] })
    setTagInput('')
  }

  function handleCompTitle(index: number, value: string) {
    const next = [...form.compTitles]
    next[index] = value
    update({ compTitles: next })
  }

  async function handleSave() {
    if (!form.title.trim()) {
      setTitleError('Title is required')
      return
    }
    setTitleError(null)
    setSaving(true)
    setError(null)
    try {
      const result = await updateBookDetailsAction(bookId, {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        synopsis: form.synopsis.trim() || null,
        coverUrl: form.coverUrl,
        genre: form.genre || null,
        subgenre: form.subgenre || null,
        tags: form.tags,
        targetAudience: form.targetAudience || null,
        contentWarnings: form.contentWarnings,
        compTitles: form.compTitles.map(s => s.trim()).filter(Boolean),
        language: form.language || null,
        seriesName: form.isSeriesBook ? (form.seriesName.trim() || null) : null,
        seriesNumber: form.isSeriesBook && form.seriesNumber
          ? parseInt(form.seriesNumber, 10)
          : null,
        visibility: form.visibility,
        discoverable: form.discoverable,
      })
      if (!result.success) { setError(result.error); return }
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2200)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const visibilityMeta: Record<Visibility, { icon: React.ReactNode; label: string }> = {
    PRIVATE: { icon: <Lock size={12} />, label: 'Private' },
    FRIENDS: { icon: <Users size={12} />, label: 'Friends' },
    PUBLIC:  { icon: <Globe size={12} />, label: 'Public'  },
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      background: 'var(--canvas-dark-100)',
      color: 'var(--canvas-dark-ink-strong)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-10 flex items-center gap-4 px-6 sm:px-8 backdrop-blur"
        style={{
          height: 60,
          borderBottom: '0.5px solid oklch(1 0 0 / 0.07)',
          background: 'oklch(0.18 0.003 256 / 0.92)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
            color: 'var(--canvas-dark-ink-muted)',
            opacity: 0.6,
          }}>
            Book details
          </div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--canvas-dark-ink-strong)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {initial.title}
          </div>
        </div>

        {savedFlash && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: 'var(--brand)',
          }}>
            Saved
          </span>
        )}

        <Link
          href={`/${locale}/studio/${bookId}`}
          style={{ fontSize: 13, color: 'var(--canvas-dark-ink-muted)', opacity: 0.6, textDecoration: 'none' }}
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          style={{
            background: 'var(--brand)',
            color: 'var(--brand-ink)',
            border: 'none',
            borderRadius: 'var(--r-pill)',
            padding: '8px 20px',
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            cursor: (!dirty || saving) ? 'not-allowed' : 'pointer',
            opacity: (!dirty || saving) ? 0.4 : 1,
            transition: 'opacity 0.12s',
          }}
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>

        <Link
          href={`/${locale}/studio/${bookId}`}
          aria-label="Close"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 34,
            height: 34,
            borderRadius: '50%',
            border: '1px solid oklch(1 0 0 / 0.10)',
            color: 'var(--canvas-dark-ink-muted)',
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          <X size={15} />
        </Link>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{
          maxWidth: 980,
          margin: '0 auto',
          padding: '36px 24px 120px',
          display: 'grid',
          gridTemplateColumns: '200px 1fr',
          gap: 24,
          alignItems: 'start',
        }}>
          {/* ── Sidebar ─────────────────────────────────────────────────── */}
          <aside style={{ position: 'sticky', top: 76, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Cover card */}
            <div style={{ ...panelStyle, padding: 16 }}>
              {/* Cover image */}
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  width: '100%',
                  aspectRatio: '2/3',
                  borderRadius: 12,
                  overflow: 'hidden',
                  position: 'relative',
                  cursor: 'pointer',
                  background: preview
                    ? undefined
                    : 'linear-gradient(160deg, var(--canvas-dark-350) 0%, var(--canvas-dark-200) 100%)',
                  border: preview ? undefined : '1.5px dashed oklch(1 0 0 / 0.12)',
                  display: 'flex',
                  alignItems: preview ? undefined : 'center',
                  justifyContent: preview ? undefined : 'center',
                }}
              >
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ textAlign: 'center', padding: '0 12px' }}>
                    <Upload size={20} style={{ color: 'var(--canvas-dark-ink-muted)', opacity: 0.4, margin: '0 auto 8px' }} />
                    <p style={{ fontSize: 11, color: 'var(--canvas-dark-ink-muted)', opacity: 0.5, lineHeight: 1.4 }}>
                      {cloudinaryConfigured ? (uploading ? 'Uploading...' : 'Click to upload') : 'Cover upload unavailable'}
                    </p>
                    {cloudinaryConfigured && (
                      <p style={{ fontSize: 10, color: 'var(--canvas-dark-ink-muted)', opacity: 0.3, marginTop: 4 }}>Portrait ratio</p>
                    )}
                  </div>
                )}

                {/* Hover overlay when image present */}
                {preview && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'oklch(0 0 0 / 0)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.15s',
                  }}
                  className="cover-hover-overlay"
                  >
                    <span style={{
                      background: 'oklch(0 0 0 / 0.55)',
                      color: '#fff',
                      borderRadius: 'var(--r-pill)',
                      padding: '5px 14px',
                      fontSize: 11,
                      fontWeight: 600,
                      opacity: 0,
                    }} className="cover-hover-label">
                      Change cover
                    </span>
                  </div>
                )}

                {uploading && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'oklch(0 0 0 / 0.55)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <div style={{
                      width: 22,
                      height: 22,
                      border: '2px solid var(--brand)',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite',
                    }} />
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFile} />

              {/* Cover action buttons */}
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  style={{
                    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                    border: 'none',
                    borderTop: 'var(--br-card)',
                    borderRadius: 'var(--r-row)',
                    boxShadow: 'var(--sh-tile)',
                    padding: '7px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--canvas-dark-ink)',
                    cursor: 'pointer',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Upload size={12} />
                  {preview ? 'Change cover' : 'Upload cover'}
                </button>
                {preview && (
                  <button
                    type="button"
                    onClick={() => { setPreview(null); update({ coverUrl: null }) }}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: 11,
                      color: 'var(--canvas-dark-ink-muted)',
                      opacity: 0.45,
                      cursor: 'pointer',
                      padding: '4px 0',
                      textAlign: 'center',
                      width: '100%',
                    }}
                  >
                    Remove cover
                  </button>
                )}
              </div>
            </div>

            {/* At a glance card */}
            <div style={{ ...panelStyle, padding: 14 }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                color: 'var(--brand)',
                opacity: 0.8,
                marginBottom: 10,
              }}>
                At a glance
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[
                  {
                    label: 'Visibility',
                    value: (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--brand)', fontWeight: 700, fontSize: 12 }}>
                        {visibilityMeta[form.visibility].icon}
                        {visibilityMeta[form.visibility].label}
                      </span>
                    ),
                  },
                  {
                    label: 'Discover',
                    value: <span style={{ fontSize: 12, fontWeight: 700, color: form.discoverable ? 'var(--canvas-dark-ink-strong)' : 'var(--canvas-dark-ink-muted)' }}>
                      {form.discoverable ? 'On' : 'Off'}
                    </span>,
                  },
                  {
                    label: 'Genre',
                    value: <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--canvas-dark-ink-strong)' }}>
                      {form.genre || <span style={{ opacity: 0.35, fontWeight: 400 }}>Not set</span>}
                    </span>,
                  },
                ].map(row => (
                  <div key={row.label} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 8px',
                    borderRadius: 'var(--r-btn)',
                    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                    boxShadow: 'var(--sh-tile)',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      textTransform: 'uppercase',
                      letterSpacing: '0.10em',
                      color: 'var(--canvas-dark-ink-muted)',
                      opacity: 0.7,
                    }}>
                      {row.label}
                    </span>
                    {row.value}
                  </div>
                ))}
              </div>
            </div>

          </aside>

          {/* ── Main sections ────────────────────────────────────────────── */}
          <main style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* BASICS */}
            <section style={{ ...panelStyle, padding: '22px 24px' }}>
              <SectionHeading title="Basics" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Title <span style={{ color: 'var(--brand)' }}>*</span></label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => update({ title: e.target.value })}
                    style={{
                      ...fieldStyle,
                      outline: titleError ? '2px solid oklch(0.55 0.15 25 / 0.55)' : undefined,
                    }}
                  />
                  {titleError && <p style={{ fontSize: 12, color: 'oklch(0.65 0.15 25)', marginTop: 4 }}>{titleError}</p>}
                </div>
                <div>
                  <label style={labelStyle}>
                    Subtitle <span style={{ opacity: 0.4, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>optional</span>
                  </label>
                  <input
                    type="text"
                    value={form.subtitle}
                    onChange={e => update({ subtitle: e.target.value })}
                    placeholder="A subtitle or tagline"
                    style={fieldStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Synopsis <span style={{ opacity: 0.4, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>optional</span>
                  </label>
                  <textarea
                    value={form.synopsis}
                    onChange={e => update({ synopsis: e.target.value })}
                    rows={5}
                    maxLength={2000}
                    placeholder="Back-cover blurb or a brief summary..."
                    style={{ ...fieldStyle, resize: 'none' }}
                  />
                  <p style={{ fontSize: 11, color: 'var(--canvas-dark-ink-muted)', opacity: 0.3, marginTop: 4, textAlign: 'right' }}>
                    {form.synopsis.length}/2000
                  </p>
                </div>
              </div>
            </section>

            {/* DISCOVERY */}
            <section style={{ ...panelStyle, padding: '22px 24px' }}>
              <SectionHeading title="Discovery" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Genre</label>
                    <select
                      value={form.genre}
                      onChange={e => update({ genre: e.target.value, subgenre: '' })}
                      style={{ ...fieldStyle, appearance: 'none', cursor: 'pointer' }}
                    >
                      <option value="">Select genre...</option>
                      {GENRE_NAMES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Subgenre</label>
                    <select
                      value={form.subgenre}
                      onChange={e => update({ subgenre: e.target.value })}
                      disabled={!form.genre || subgenres.length === 0}
                      style={{ ...fieldStyle, appearance: 'none', cursor: (!form.genre || subgenres.length === 0) ? 'not-allowed' : 'pointer', opacity: (!form.genre || subgenres.length === 0) ? 0.4 : 1 }}
                    >
                      <option value="">Select subgenre...</option>
                      {subgenres.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Target audience</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {TARGET_AUDIENCES.map(a => (
                      <Chip
                        key={a}
                        label={a}
                        active={form.targetAudience === a}
                        onClick={() => update({ targetAudience: form.targetAudience === a ? '' : a })}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>
                    Tags{' '}
                    <span style={{ opacity: 0.4, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({form.tags.length}/10)</span>
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 8 }}>
                    {PREDEFINED_TAGS.map(t => (
                      <Chip
                        key={t}
                        label={t}
                        active={form.tags.includes(t)}
                        disabled={form.tags.length >= 10 && !form.tags.includes(t)}
                        onClick={() => {
                          if (form.tags.length >= 10 && !form.tags.includes(t)) return
                          update({ tags: toggleItem(form.tags, t) })
                        }}
                      />
                    ))}
                  </div>
                  {/* Custom tags */}
                  {form.tags.filter(t => !(PREDEFINED_TAGS as readonly string[]).includes(t)).map(t => (
                    <span key={t} style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 10px',
                      borderRadius: 'var(--r-pill)',
                      fontSize: 12,
                      background: 'oklch(from var(--brand) l c h / 0.15)',
                      border: '1px solid oklch(from var(--brand) l c h / 0.35)',
                      color: 'var(--brand)',
                      marginRight: 6,
                      marginBottom: 4,
                    }}>
                      {t}
                      <button
                        type="button"
                        onClick={() => update({ tags: form.tags.filter(x => x !== t) })}
                        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.6, padding: 0, fontSize: 14, lineHeight: 1 }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {form.tags.length < 10 && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <input
                        type="text"
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addCustomTag(tagInput) }
                        }}
                        placeholder="Add custom tag..."
                        style={{ ...fieldStyle, flex: 1, fontSize: 13 }}
                      />
                      <button
                        type="button"
                        onClick={() => addCustomTag(tagInput)}
                        style={{
                          background: 'var(--brand-soft)',
                          border: 'none',
                          borderRadius: 'var(--r-pill)',
                          padding: '0 14px',
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--brand)',
                          cursor: 'pointer',
                          height: 38,
                          flexShrink: 0,
                        }}
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label style={labelStyle}>Content warnings</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {CONTENT_WARNINGS.map(w => (
                      <Chip
                        key={w}
                        label={w}
                        active={form.contentWarnings.includes(w)}
                        onClick={() => update({ contentWarnings: toggleItem(form.contentWarnings, w) })}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>
                    Comparable titles{' '}
                    <span style={{ opacity: 0.4, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>optional, up to 5</span>
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {form.compTitles.map((t, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="text"
                          placeholder="Readers who liked..."
                          value={t}
                          onChange={e => handleCompTitle(i, e.target.value)}
                          style={{ ...fieldStyle, flex: 1 }}
                        />
                        {form.compTitles.length > 1 && (
                          <button
                            type="button"
                            onClick={() => update({ compTitles: form.compTitles.filter((_, idx) => idx !== i) })}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--canvas-dark-ink-muted)',
                              opacity: 0.4,
                              cursor: 'pointer',
                              fontSize: 18,
                              padding: '0 8px',
                              lineHeight: 1,
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    {form.compTitles.length < 5 && form.compTitles[form.compTitles.length - 1] !== '' && (
                      <button
                        type="button"
                        onClick={() => update({ compTitles: [...form.compTitles, ''] })}
                        style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--brand)', opacity: 0.7, cursor: 'pointer', textAlign: 'left', padding: 0 }}
                      >
                        + Add another title
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ maxWidth: 220 }}>
                  <label style={labelStyle}>Language</label>
                  <select
                    value={form.language}
                    onChange={e => update({ language: e.target.value })}
                    style={{ ...fieldStyle, appearance: 'none', cursor: 'pointer' }}
                  >
                    <option value="">Select language...</option>
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
            </section>

            {/* STRUCTURE */}
            <section style={{ ...panelStyle, padding: '22px 24px' }}>
              <SectionHeading title="Structure" />
              <p style={{ fontSize: 12, color: 'var(--canvas-dark-ink-muted)', opacity: 0.65, lineHeight: 1.65, marginBottom: 14 }}>
                Series metadata appears on your reader page, library card, and any discoverable surface. Readers can jump between books in the series.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxWidth: 340 }}>
                {(['Standalone', 'Series'] as const).map(opt => {
                  const active = (opt === 'Series') === form.isSeriesBook
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => update({ isSeriesBook: opt === 'Series' })}
                      style={{
                        padding: '9px',
                        borderRadius: 'var(--r-row)',
                        border: active ? '1.5px solid oklch(from var(--brand) l c h / 0.40)' : '1px solid transparent',
                        background: active ? 'var(--brand-soft)' : 'var(--canvas-dark-300)',
                        color: active ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                      }}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
              {form.isSeriesBook && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, marginTop: 14 }}>
                  <div>
                    <label style={labelStyle}>Series name</label>
                    <input
                      type="text"
                      placeholder="e.g. The Stormlight Archive"
                      value={form.seriesName}
                      onChange={e => update({ seriesName: e.target.value })}
                      style={fieldStyle}
                    />
                  </div>
                  <div style={{ width: 90 }}>
                    <label style={labelStyle}>Book #</label>
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      placeholder="1"
                      value={form.seriesNumber}
                      onChange={e => update({ seriesNumber: e.target.value })}
                      style={fieldStyle}
                    />
                  </div>
                </div>
              )}
              <p style={{ fontSize: 11, color: 'var(--canvas-dark-ink-muted)', opacity: 0.3, marginTop: 16, lineHeight: 1.5 }}>
                The template you picked at creation seeded your binder once. Reorganize chapters directly from the binder.
              </p>
            </section>

            {/* SHARING */}
            <section style={{ ...panelStyle, padding: '22px 24px' }}>
              <SectionHeading title="Sharing" />
              <SharingControls
                visibility={form.visibility}
                discoverable={form.discoverable}
                onChange={({ visibility, discoverable }) => {
                  const patch: Partial<FormState> = {}
                  if (visibility !== undefined) {
                    patch.visibility = visibility
                    if (visibility !== 'PUBLIC') patch.discoverable = false
                  }
                  if (discoverable !== undefined) patch.discoverable = discoverable
                  update(patch)
                }}
              />
            </section>

            {/* PUBLISHING */}
            <section style={{ ...panelStyle, padding: '22px 24px' }}>
              <SectionHeading
                title="Publishing"
                badge={
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'var(--brand)',
                    color: 'var(--brand-ink)',
                    borderRadius: 'var(--r-pill)',
                    padding: '2px 8px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}>
                    <Sparkles size={10} />
                    Premium
                  </span>
                }
              />
              {!isPremium && (
                <div style={{
                  background: 'oklch(from var(--brand) l c h / 0.08)',
                  border: '1px solid oklch(from var(--brand) l c h / 0.20)',
                  borderRadius: 'var(--r-row)',
                  padding: '12px 14px',
                  fontSize: 12,
                  color: 'var(--canvas-dark-ink-muted)',
                  lineHeight: 1.65,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  marginBottom: 16,
                }}>
                  <Sparkles size={14} style={{ color: 'var(--brand)', flexShrink: 0, marginTop: 1 }} />
                  <span>
                    Publishing details are a Premium feature. Unlock imprint, ISBN, trim size, author bio, and dedication.{' '}
                    <Link href={`/${locale}/pricing`} style={{ color: 'var(--brand)', textDecoration: 'none' }}>
                      Upgrade →
                    </Link>
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <ReadonlyField label="Publisher name" value={initial.publisherName} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <ReadonlyField label="Trim size" value={initial.trimSize} />
                  <ReadonlyField label="Edition" value={initial.edition} />
                </div>
                <ReadonlyField label="ISBN" value={initial.isbn} />
                <ReadonlyField label="Author bio" value={initial.authorBio} multiline />
                <ReadonlyField label="Dedication" value={initial.dedication} multiline />
                <p style={{ fontSize: 11, color: 'var(--canvas-dark-ink-muted)', opacity: 0.3, lineHeight: 1.5, marginTop: 4 }}>
                  {isPremium
                    ? 'To edit these, open the Publishing details expander in the metadata panel inside the editor.'
                    : 'Subtitle is editable above in Basics. Other publishing fields require Premium.'}
                </p>
              </div>
            </section>

            {/* Error banner */}
            {error && (
              <div
                role="alert"
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--r-row)',
                  background: 'oklch(0.30 0.10 25 / 0.20)',
                  border: '1px solid oklch(0.55 0.15 25 / 0.45)',
                  color: 'oklch(0.85 0.12 25)',
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            {/* DANGER ZONE */}
            <section style={{
              ...panelStyle,
              padding: '20px 24px',
              marginTop: 8,
            }}>
              <h2 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--canvas-dark-ink-muted)',
                marginBottom: 6,
                opacity: 0.7,
              }}>
                Danger Zone
              </h2>
              <p style={{ fontSize: 12, color: 'var(--canvas-dark-ink-muted)', opacity: 0.5, marginBottom: 14, lineHeight: 1.5 }}>
                Permanently delete this book and everything in it.
              </p>
              <DeleteBookButton bookId={bookId} bookTitle={initial.title} locale={locale}>
                {(onTrigger) => (
                  <button
                    type="button"
                    onClick={onTrigger}
                    style={{
                      background: 'none',
                      border: '1px solid oklch(0.55 0.15 25 / 0.28)',
                      borderRadius: 'var(--r-row)',
                      padding: '7px 16px',
                      fontSize: 12,
                      color: 'oklch(0.65 0.12 25)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget
                      el.style.background = 'oklch(0.55 0.15 25 / 0.10)'
                      el.style.borderColor = 'oklch(0.55 0.15 25 / 0.55)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget
                      el.style.background = 'none'
                      el.style.borderColor = 'oklch(0.55 0.15 25 / 0.28)'
                    }}
                  >
                    <Trash2 size={13} />
                    Delete this book
                  </button>
                )}
              </DeleteBookButton>
            </section>

          </main>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .cover-hover-overlay:hover { background: oklch(0 0 0 / 0.35) !important; }
        .cover-hover-overlay:hover .cover-hover-label { opacity: 1 !important; }
      `}</style>
    </div>
  )
}

// ─── Readonly subcomponent ────────────────────────────────────────────────────

function ReadonlyField({ label, value, multiline = false }: {
  label: string; value: string | null; multiline?: boolean
}) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={{
        background: 'var(--canvas-dark-100)',
        boxShadow: 'var(--sh-inset)',
        borderRadius: 'var(--r-row)',
        padding: '10px 14px',
        fontSize: 14,
        minHeight: multiline ? 80 : undefined,
        whiteSpace: multiline ? 'pre-wrap' : undefined,
        color: 'var(--canvas-dark-ink-muted)',
      }}>
        {value || <span style={{ opacity: 0.3, fontStyle: 'italic' }}>Not set</span>}
      </div>
    </div>
  )
}
