'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Sparkles, Trash2, X } from 'lucide-react'
import {
  updateBookDetailsAction,
  type BookDetails,
} from '@/lib/actions/book.actions'
import { SharingControls, type Visibility } from '@/components/book/sharing-controls'
import { DeleteBookButton } from '@/components/book/delete-book-button'
import { Button } from '@/components/ui/button'
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

// Deep-ish equality for dirty tracking — fields are scalars or string[] only.
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

// ─── Shared field styles (iOS modal recipe — matches CreateListModal etc.) ──

const fieldClass =
  'w-full rounded-[var(--r-row)] px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)] transition-shadow'
const fieldStyle = {
  background: '#1E1E1E',
  boxShadow: 'var(--sh-inset)',
  color: 'var(--canvas-dark-ink)',
} as const
const labelClass =
  'block text-[10px] font-mono uppercase tracking-[0.14em] mb-2 text-[var(--canvas-dark-ink-muted)]'
const selectClass = `${fieldClass} appearance-none cursor-pointer`

// ─── Section shell ────────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  defaultOpen = true,
  premium = false,
  children,
}: {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  premium?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section
      style={{
        background: 'var(--canvas-dark-100, #1a1a1a)',
        border: '1px solid var(--canvas-dark-300, #2a2a2a)',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 px-6 py-4 cursor-pointer text-left"
        aria-expanded={open}
      >
        <div className="min-w-0 flex items-center gap-3">
          {open ? <ChevronDown size={16} className="text-white/40" /> : <ChevronRight size={16} className="text-white/40" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 17,
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  color: 'var(--canvas-dark-ink-strong, #fff)',
                }}
              >
                {title}
              </h2>
              {premium && (
                <span
                  className="inline-flex items-center gap-1 uppercase"
                  style={{
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'var(--brand, #FFC300)',
                    color: 'var(--brand-ink, #0a0a0a)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    fontWeight: 700,
                  }}
                >
                  <Sparkles size={10} /> Premium
                </span>
              )}
            </div>
            {subtitle && (
              <p
                style={{
                  fontFamily: 'var(--font-prose)',
                  fontSize: 13,
                  color: 'var(--canvas-dark-ink-muted, #999)',
                  marginTop: 4,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </button>
      {open && <div className="px-6 pb-6 pt-1">{children}</div>}
    </section>
  )
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({
  label,
  active,
  onClick,
  disabled = false,
}: {
  label: string
  active: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center px-3 h-7 rounded-[var(--r-pill)] text-[12px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? 'bg-[var(--brand)] text-[var(--brand-ink)]'
          : 'bg-[var(--canvas-dark-300)] text-[var(--canvas-dark-ink-muted)] hover:text-[var(--canvas-dark-ink-strong)]'
      }`}
    >
      {label}
    </button>
  )
}

// ─── The form ─────────────────────────────────────────────────────────────────

type Props = {
  locale: string
  bookId: string
  initial: BookDetails
  isPremium: boolean
}

export function BookDetailsForm({ locale, bookId, initial, isPremium }: Props) {
  const router = useRouter()
  const initialState = useMemo(() => toFormState(initial), [initial])
  const [form, setForm] = useState<FormState>(initialState)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  // Cover upload
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

      if (!result.success) {
        setError(result.error)
        return
      }

      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2200)
      // Refresh so the studio page picks up new title/cover/etc.
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="flex flex-col"
      style={{
        minHeight: 'calc(100vh - 56px)',
        background: 'var(--canvas-dark-50, #141414)',
        color: 'var(--canvas-dark-ink-strong, #fff)',
      }}
    >
      {/* ── Top bar ── */}
      <header
        className="sticky top-0 z-10 flex items-center gap-6 px-6 sm:px-10 backdrop-blur"
        style={{
          height: 64,
          borderBottom: '1px solid var(--canvas-dark-300, #2a2a2a)',
          background: 'oklch(0.18 0.003 256 / 0.85)',
        }}
      >
        <div className="min-w-0 flex flex-col">
          <div
            className="uppercase"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.18em',
              color: 'var(--canvas-dark-ink-muted, #777)',
            }}
          >
            Book details
          </div>
          <div
            className="truncate"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--canvas-dark-ink-strong, #fff)',
            }}
          >
            {initial.title}
          </div>
        </div>

        <div className="flex-1" />

        {savedFlash && (
          <span
            className="uppercase"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.10em',
              color: 'var(--brand, #FFC300)',
            }}
          >
            Saved
          </span>
        )}

        <Link
          href={`/${locale}/studio/${bookId}`}
          className="text-[13px] text-white/50 hover:text-white/80 transition-colors"
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="inline-flex items-center justify-center h-9 px-5 rounded-[var(--r-pill)] text-[13px] font-bold font-comfortaa disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>

        <Link
          href={`/${locale}/studio/${bookId}`}
          aria-label="Close"
          className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[var(--canvas-dark-300,#2a2a2a)] text-white/60 hover:text-white transition-colors"
        >
          <X size={16} />
        </Link>
      </header>

      {/* ── Body ── */}
      <div className="flex-1">
        <div
          className="mx-auto w-full flex flex-col gap-5"
          style={{ maxWidth: 760, padding: '40px 24px 120px' }}
        >
          {/* ── BASICS ── */}
          <Section
            title="Basics"
            subtitle="The cover, title, and synopsis your readers see first."
          >
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Title <span className="text-brand">*</span></label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => update({ title: e.target.value })}
                  className={`${fieldClass} ${titleError ? 'ring-2 ring-red-400/50' : ''}`}
                  style={fieldStyle}
                />
                {titleError && <p className="text-[12px] text-red-400 mt-1">{titleError}</p>}
              </div>

              <div>
                <label className={labelClass}>
                  Subtitle <span className="text-white/30 font-normal">optional</span>
                </label>
                <input
                  type="text"
                  value={form.subtitle}
                  onChange={e => update({ subtitle: e.target.value })}
                  placeholder="A subtitle or tagline"
                  className={fieldClass}
                  style={fieldStyle}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Synopsis <span className="text-white/30 font-normal">optional</span>
                </label>
                <textarea
                  value={form.synopsis}
                  onChange={e => update({ synopsis: e.target.value })}
                  rows={5}
                  maxLength={2000}
                  className={`${fieldClass} resize-none`}
                  style={fieldStyle}
                  placeholder="Back-cover blurb or a brief summary…"
                />
                <p className="text-[11px] text-white/25 mt-1 text-right">{form.synopsis.length}/2000</p>
              </div>

              <div>
                <label className={labelClass}>
                  Cover image <span className="text-white/30 font-normal">optional</span>
                </label>
                <div
                  onClick={() => cloudinaryConfigured && fileRef.current?.click()}
                  className={`relative border border-dashed border-border rounded-xl overflow-hidden flex items-center justify-center
                    ${cloudinaryConfigured ? 'cursor-pointer hover:border-brand/40 transition-colors' : 'opacity-40 cursor-not-allowed'}
                    ${preview ? 'h-48' : 'h-28'}`}
                >
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center">
                      <p className="text-[13px] text-white/40">
                        {cloudinaryConfigured ? (uploading ? 'Uploading…' : 'Click to upload cover') : 'Cover upload unavailable'}
                      </p>
                      {cloudinaryConfigured && <p className="text-[11px] text-white/25 mt-1">Portrait ratio · PNG or JPG</p>}
                    </div>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                {preview && cloudinaryConfigured && (
                  <button
                    type="button"
                    onClick={() => { setPreview(null); update({ coverUrl: null }) }}
                    className="text-[11px] text-white/35 hover:text-white/60 mt-1 transition-colors"
                  >
                    Remove cover
                  </button>
                )}
              </div>
            </div>
          </Section>

          {/* ── DISCOVERY ── */}
          <Section
            title="Discovery"
            subtitle="How readers find your book — genre, audience, tags, comp titles."
          >
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Genre</label>
                  <select
                    value={form.genre}
                    onChange={e => update({ genre: e.target.value, subgenre: '' })}
                    className={selectClass}
                    style={fieldStyle}
                  >
                    <option value="">Select genre…</option>
                    {GENRE_NAMES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Subgenre</label>
                  <select
                    value={form.subgenre}
                    onChange={e => update({ subgenre: e.target.value })}
                    disabled={!form.genre || subgenres.length === 0}
                    className={`${selectClass} disabled:opacity-40 disabled:cursor-not-allowed`}
                    style={fieldStyle}
                  >
                    <option value="">Select subgenre…</option>
                    {subgenres.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Target audience</label>
                <div className="flex flex-wrap gap-2">
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
                <label className={labelClass}>
                  Tags <span className="text-white/30 font-normal">({form.tags.length}/10)</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PREDEFINED_TAGS.map(t => (
                    <Chip
                      key={t}
                      label={t}
                      active={form.tags.includes(t)}
                      onClick={() => {
                        if (form.tags.length >= 10 && !form.tags.includes(t)) return
                        update({ tags: toggleItem(form.tags, t) })
                      }}
                    />
                  ))}
                </div>
                {form.tags.filter(t => !(PREDEFINED_TAGS as readonly string[]).includes(t)).map(t => (
                  <span key={t} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] bg-brand/15 border border-brand/40 text-brand mr-1.5 mb-1.5">
                    {t}
                    <button
                      type="button"
                      onClick={() => update({ tags: form.tags.filter(x => x !== t) })}
                      className="text-brand/60 hover:text-brand ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {form.tags.length < 10 && (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault()
                          addCustomTag(tagInput)
                        }
                      }}
                      placeholder="Add custom tag…"
                      className="flex-1 rounded-[var(--r-row)] px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)] transition-shadow"
                      style={fieldStyle}
                    />
                    <button
                      type="button"
                      onClick={() => addCustomTag(tagInput)}
                      className="inline-flex items-center text-[12px] font-semibold h-9 px-3 rounded-[var(--r-pill)] transition-colors"
                      style={{
                        background: 'var(--brand-soft)',
                        color: 'var(--brand)',
                      }}
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className={labelClass}>Content warnings</label>
                <div className="flex flex-wrap gap-1.5">
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
                <label className={labelClass}>
                  Comparable titles <span className="text-white/30 font-normal">optional · up to 5</span>
                </label>
                <div className="space-y-2">
                  {form.compTitles.map((t, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Readers who liked…"
                        value={t}
                        onChange={e => handleCompTitle(i, e.target.value)}
                        className="flex-1 rounded-[var(--r-row)] px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)] transition-shadow"
                        style={fieldStyle}
                      />
                      {form.compTitles.length > 1 && (
                        <button
                          type="button"
                          onClick={() => update({ compTitles: form.compTitles.filter((_, idx) => idx !== i) })}
                          className="text-white/30 hover:text-white/60 px-2 transition-colors text-[18px] leading-none"
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
                      className="text-[12px] text-brand/70 hover:text-brand transition-colors"
                    >
                      + Add another title
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className={labelClass}>Language</label>
                <select
                  value={form.language}
                  onChange={e => update({ language: e.target.value })}
                  className={selectClass}
                  style={fieldStyle}
                >
                  <option value="">Select language…</option>
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          </Section>

          {/* ── STRUCTURE ── */}
          <Section
            title="Structure"
            subtitle="Standalone or part of a series."
          >
            <p className="text-[12px] text-muted-foreground leading-relaxed mb-3">
              Is this book part of a series? If so, the series name and number will appear on your book&apos;s reader page, library card, and any discoverable surface — and readers will be able to jump between books in the series.
            </p>
            <div className="flex gap-2 mb-3">
              {(['Standalone', 'Series'] as const).map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => update({ isSeriesBook: opt === 'Series' })}
                  className={`flex-1 py-2.5 rounded-xl border text-[13px] font-medium transition-colors
                    ${(opt === 'Series') === form.isSeriesBook
                      ? 'border-[oklch(from_var(--brand)_l_c_h_/_0.35)] bg-[var(--brand-soft)] text-[var(--brand)]'
                      : 'border-transparent bg-[var(--canvas-dark-300)] text-[var(--canvas-dark-ink-muted)] hover:text-[var(--canvas-dark-ink-strong)]'
                    }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            {form.isSeriesBook && (
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className={labelClass}>Series name</label>
                  <input
                    type="text"
                    placeholder="e.g. The Stormlight Archive"
                    value={form.seriesName}
                    onChange={e => update({ seriesName: e.target.value })}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Book #</label>
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    placeholder="1"
                    value={form.seriesNumber}
                    onChange={e => update({ seriesNumber: e.target.value })}
                    className={fieldClass}
                  />
                </div>
              </div>
            )}
            <p className="text-[11px] text-white/30 mt-4">
              The template you picked at creation seeded your binder once — it isn’t a current
              setting to change. Reorganize chapters directly from the binder instead.
            </p>
          </Section>

          {/* ── PUBLISHING ── */}
          <Section
            title="Publishing"
            subtitle="Imprint, trim size, ISBN, dedication — appears in your front/back matter."
            premium
          >
            {!isPremium && (
              <div
                className="mb-4 p-3 rounded-lg flex items-start gap-3"
                style={{
                  background: 'oklch(from var(--color-brand) l c h / 0.10)',
                  border: '1px solid oklch(from var(--color-brand) l c h / 0.30)',
                }}
              >
                <Sparkles size={16} className="mt-0.5 text-brand flex-shrink-0" />
                <div className="text-[12px] leading-relaxed text-white/70">
                  Publishing details are a Premium feature. You can view what you entered at creation,
                  but you need Premium to edit publisher, trim size, edition, ISBN, author bio, or dedication.
                  <Link href={`/${locale}/pricing`} className="text-brand hover:underline ml-1">
                    Upgrade →
                  </Link>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <ReadonlyField label="Publisher name" value={initial.publisherName} />
              <div className="grid grid-cols-2 gap-3">
                <ReadonlyField label="Trim size" value={initial.trimSize} />
                <ReadonlyField label="Edition" value={initial.edition} />
              </div>
              <ReadonlyField label="ISBN" value={initial.isbn} />
              <ReadonlyField label="Author bio" value={initial.authorBio} multiline />
              <ReadonlyField label="Dedication" value={initial.dedication} multiline />
              <p className="text-[11px] text-white/30 mt-2">
                {isPremium
                  ? 'To edit these, open the Publishing details expander in the metadata panel inside the editor.'
                  : 'Subtitle is editable above in Basics. Other publishing fields require Premium.'}
              </p>
            </div>
          </Section>

          {/* ── SHARING ── */}
          <Section
            title="Sharing"
            subtitle="Who can read this book, and whether it appears on Discover."
          >
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
          </Section>

          {/* ── Error banner ── */}
          {error && (
            <div
              role="alert"
              className="p-3 rounded-lg"
              style={{
                background: 'oklch(0.30 0.10 25 / 0.20)',
                border: '1px solid oklch(0.55 0.15 25 / 0.45)',
                color: 'oklch(0.85 0.12 25)',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {/* ── DANGER ZONE ── (intentionally outside any form element) */}
          <section className="rounded-lg border border-destructive/30 p-5 mt-6">
            <h2 className="text-destructive text-[15px] font-semibold mb-1">Danger Zone</h2>
            <p className="text-foreground/65 text-[13px] mb-4">
              Permanently delete this book and everything in it.
            </p>
            <DeleteBookButton bookId={bookId} bookTitle={initial.title} locale={locale}>
              {(onTrigger) => (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onTrigger}
                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                >
                  <Trash2 size={14} className="mr-2" />
                  Delete this book
                </Button>
              )}
            </DeleteBookButton>
          </section>
        </div>
      </div>
    </div>
  )
}

// ─── Readonly subcomponent ────────────────────────────────────────────────────

function ReadonlyField({
  label,
  value,
  multiline = false,
}: {
  label: string
  value: string | null
  multiline?: boolean
}) {
  return (
    <div>
      <div className={labelClass}>{label}</div>
      <div
        className={`rounded-[var(--r-row)] px-3.5 py-2.5 text-[14px] ${multiline ? 'min-h-[80px] whitespace-pre-wrap' : ''}`}
        style={{
          background: '#1E1E1E',
          boxShadow: 'var(--sh-inset)',
          color: 'var(--canvas-dark-ink-muted)',
        }}
      >
        {value || <span className="text-white/25 italic">Not set</span>}
      </div>
    </div>
  )
}
