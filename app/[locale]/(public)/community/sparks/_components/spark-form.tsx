'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { VisibilityPicker, PUBLIC_FRIENDS_PRIVATE_OPTIONS } from '@/components/visibility-picker'
import { createSparkAction, updateSparkAction } from '@/lib/actions/sparks.actions'
import { TITLE_MAX, PROMPT_MAX } from '@/lib/validations/spark'
import { GENRES, GENRE_LABEL } from '@/lib/discover/genres'
import type { SparkEditData } from '@/lib/actions/sparks.actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type Visibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE'

const WORD_LIMIT_PRESETS = [300, 1000, 2500] as const

const VOTING_DURATION_OPTIONS = [
  { value: 24, label: '24 hours' },
  { value: 48, label: '48 hours (default)' },
  { value: 72, label: '72 hours' },
  { value: 168, label: '7 days' },
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultDeadline(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  d.setHours(23, 59, 0, 0)
  return d
}

function computeVotingDurationHours(editData: SparkEditData): number {
  if (!editData.votingEndsAt) return 48
  const diff = Math.round(
    (editData.votingEndsAt.getTime() - editData.deadline.getTime()) / 3600_000,
  )
  return [24, 48, 72, 168].includes(diff) ? diff : 48
}

function getInitialState(props: SparkFormProps) {
  if (props.mode === 'edit' && props.editData) {
    const { editData } = props
    const presets: number[] = [300, 1000, 2500]
    const isPreset = presets.includes(editData.wordLimit ?? -1)
    return {
      title: editData.title,
      prompt: editData.prompt,
      description: editData.description ?? '',
      rules: editData.rules ?? '',
      wordLimitMode: (editData.wordLimit == null
        ? 'none'
        : isPreset
        ? 'preset'
        : 'custom') as 'none' | 'preset' | 'custom',
      wordLimitPreset: isPreset ? (editData.wordLimit ?? 1000) : 1000,
      wordLimitCustom:
        !isPreset && editData.wordLimit != null ? String(editData.wordLimit) : '',
      deadline: editData.deadline,
      votingDurationHours: computeVotingDurationHours(editData),
      genre: editData.genre ?? '',
      visibility: editData.visibility as Visibility,
      discoverable: editData.discoverable,
    }
  }

  const wlPreset = [300, 1000, 2500].includes(props.defaultWordLimit ?? -1)
  return {
    title: '',
    prompt: props.defaultPrompt ?? '',
    description: '',
    rules: '',
    wordLimitMode: (props.defaultWordLimit == null
      ? 'preset'
      : wlPreset
      ? 'preset'
      : 'custom') as 'none' | 'preset' | 'custom',
    wordLimitPreset: wlPreset ? (props.defaultWordLimit ?? 1000) : 1000,
    wordLimitCustom:
      !wlPreset && props.defaultWordLimit != null ? String(props.defaultWordLimit) : '',
    deadline: defaultDeadline(),
    votingDurationHours: 48,
    genre: '',
    visibility: 'PUBLIC' as Visibility,
    discoverable: true,
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '22px 0 16px' }}>
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

// ─── Props ────────────────────────────────────────────────────────────────────

export type SparkFormProps = {
  locale: string
  mode: 'create' | 'edit'
  sparkId?: string
  editData?: SparkEditData
  defaultPrompt?: string
  defaultWordLimit?: number
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SparkForm(props: SparkFormProps) {
  const { locale, mode, sparkId, editData } = props
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [s, setS] = useState(() => getInitialState(props))

  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) =>
    setS(prev => ({ ...prev, [k]: v }))

  function resolveWordLimit(): number | null {
    if (s.wordLimitMode === 'none') return null
    if (s.wordLimitMode === 'custom') {
      const n = parseInt(s.wordLimitCustom, 10)
      return Number.isFinite(n) && n > 0 ? n : null
    }
    return s.wordLimitPreset
  }

  function handleVisibilityChange(v: Visibility) {
    set('visibility', v)
    if (v !== 'PUBLIC') set('discoverable', false)
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      if (mode === 'edit' && sparkId) {
        const result = await updateSparkAction({
          id: sparkId,
          title: s.title.trim(),
          prompt: s.prompt.trim(),
          description: s.description.trim() || undefined,
          rules: s.rules.trim() || undefined,
          wordLimit: resolveWordLimit() ?? undefined,
          genre: s.genre || undefined,
          deadline: s.deadline,
          visibility: s.visibility,
          discoverable: s.visibility === 'PUBLIC' ? s.discoverable : false,
          votingDurationHours: s.votingDurationHours,
        })
        if (result.success) {
          toast.success('Spark updated.')
          router.push(`/${locale}/community/sparks/${sparkId}`)
        } else {
          toast.error(
            result.error === 'INVALID_INPUT'
              ? 'Please check the form and try again.'
              : result.error === 'NOT_AUTHORIZED'
              ? 'You are not allowed to edit this Spark.'
              : `Something went wrong (${result.error}).`,
          )
        }
      } else {
        const result = await createSparkAction({
          title: s.title.trim(),
          prompt: s.prompt.trim(),
          description: s.description.trim() || undefined,
          rules: s.rules.trim() || undefined,
          wordLimit: resolveWordLimit() ?? undefined,
          genre: s.genre || undefined,
          deadline: s.deadline,
          visibility: s.visibility,
          discoverable: s.visibility === 'PUBLIC' ? s.discoverable : false,
          votingDurationHours: s.votingDurationHours,
        })
        if (result.success) {
          toast.success('Spark created!')
          router.push(`/${locale}/community/sparks/${result.data.id}`)
        } else {
          toast.error(
            result.error === 'INVALID_INPUT'
              ? 'Please check the form and try again.'
              : result.error === 'FREE_LIMIT_REACHED'
              ? "You've hit the free-tier Spark limit."
              : `Something went wrong (${result.error}).`,
          )
        }
      }
    })
  }

  const titleCount = s.title.length
  const titleCountColor =
    titleCount > TITLE_MAX ? '#f87171' : titleCount >= 50 ? '#facc15' : 'var(--canvas-dark-ink-muted)'

  const promptCount = s.prompt.length
  const promptCountColor =
    promptCount > PROMPT_MAX ? '#f87171' : promptCount >= 400 ? '#facc15' : 'var(--canvas-dark-ink-muted)'

  const canSubmit =
    s.title.trim().length >= 3 &&
    s.title.trim().length <= TITLE_MAX &&
    s.prompt.trim().length >= 10 &&
    s.prompt.trim().length <= PROMPT_MAX &&
    !pending

  const deadlineEditable = mode === 'create' || (editData?.status === 'OPEN')

  return (
    <form onSubmit={onSubmit}>
      {/* ── Main panel ─────────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          borderTop: 'var(--br-card)',
        }}
      >
        {/* Fields */}
        <div className="pt-2 px-6 max-md:px-4">
          <SectionDivider label="Content" />

          {/* Title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label htmlFor="sf-title" className={LABEL_CLASS} style={LABEL_STYLE}>
                Title <span style={{ color: 'var(--brand)' }}>*</span>
              </label>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: titleCountColor }}>
                {titleCount} / {TITLE_MAX}
              </span>
            </div>
            <input
              id="sf-title"
              type="text"
              value={s.title}
              onChange={e => set('title', e.target.value)}
              maxLength={TITLE_MAX + 10}
              required
              autoFocus={mode === 'create'}
              placeholder='Short and catchy. e.g. "Kingdom Heist"'
              className="w-full h-10 px-3.5 text-[14px] outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)]"
              style={INPUT_STYLE}
            />
          </div>

          {/* Prompt */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label htmlFor="sf-prompt" className={LABEL_CLASS} style={LABEL_STYLE}>
                Prompt <span style={{ color: 'var(--brand)' }}>*</span>
              </label>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: promptCountColor }}>
                {promptCount} / {PROMPT_MAX}
              </span>
            </div>
            <textarea
              id="sf-prompt"
              value={s.prompt}
              onChange={e => set('prompt', e.target.value)}
              rows={4}
              required
              placeholder="The actual writing challenge. Be specific about what writers must do."
              className="w-full px-3.5 py-2.5 text-[14px] resize-none outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)]"
              style={{ ...INPUT_STYLE, lineHeight: 1.55, fontFamily: 'var(--font-prose)' }}
            />
          </div>

          {/* Context */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            <label htmlFor="sf-desc" className={LABEL_CLASS} style={LABEL_STYLE}>
              Context (optional)
            </label>
            <textarea
              id="sf-desc"
              value={s.description}
              onChange={e => set('description', e.target.value)}
              rows={2}
              placeholder="Extra background, inspiration, or examples."
              className="w-full px-3.5 py-2.5 text-[13px] resize-none outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)]"
              style={{ ...INPUT_STYLE, lineHeight: 1.55, fontFamily: 'var(--font-prose)' }}
            />
          </div>

          {/* Rules */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 0 }}>
            <label htmlFor="sf-rules" className={LABEL_CLASS} style={LABEL_STYLE}>
              Rules (optional)
            </label>
            <textarea
              id="sf-rules"
              value={s.rules}
              onChange={e => set('rules', e.target.value)}
              rows={2}
              placeholder="Forbidden tropes, required elements, format restrictions."
              className="w-full px-3.5 py-2.5 text-[13px] resize-none outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)]"
              style={{ ...INPUT_STYLE, lineHeight: 1.55, fontFamily: 'var(--font-prose)' }}
            />
          </div>

          <SectionDivider label="Settings" />

          {/* Word limit chips */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            <span className={LABEL_CLASS} style={LABEL_STYLE}>Word limit</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['none', ...WORD_LIMIT_PRESETS, 'custom'] as const).map((v) => {
                const isActive =
                  v === 'none'
                    ? s.wordLimitMode === 'none'
                    : v === 'custom'
                    ? s.wordLimitMode === 'custom'
                    : s.wordLimitMode === 'preset' && s.wordLimitPreset === v
                const label =
                  v === 'none' ? 'No limit' : v === 'custom' ? 'Custom' : `${v.toLocaleString()}`
                return (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => {
                      if (v === 'none') set('wordLimitMode', 'none')
                      else if (v === 'custom') set('wordLimitMode', 'custom')
                      else {
                        set('wordLimitMode', 'preset')
                        set('wordLimitPreset', v)
                      }
                    }}
                    style={{
                      height: 32,
                      padding: '0 14px',
                      borderRadius: 'var(--r-pill)',
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: 'monospace',
                      cursor: 'pointer',
                      border: isActive ? 'none' : '1px solid rgba(255,255,255,0.08)',
                      background: isActive ? 'var(--brand)' : 'var(--canvas-dark-300)',
                      color: isActive ? 'var(--brand-ink)' : 'var(--canvas-dark-ink-muted)',
                      boxShadow: isActive
                        ? '0 0 0 2px rgba(255,195,0,0.2)'
                        : 'var(--sh-tile)',
                      transition: 'all 0.12s',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {s.wordLimitMode === 'custom' && (
              <input
                type="number"
                min={1}
                value={s.wordLimitCustom}
                onChange={e => set('wordLimitCustom', e.target.value)}
                placeholder="e.g. 1500"
                className="w-32 h-9 px-3 text-[13px] outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)]"
                style={{ ...INPUT_STYLE, fontFamily: 'monospace' }}
              />
            )}
          </div>

          {/* Deadline + Genre — two-column on desktop, stacked on mobile (issue #50) */}
          <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1 max-md:gap-3.5" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className={LABEL_CLASS} style={LABEL_STYLE}>Deadline</label>
                {!deadlineEditable && (
                  <span style={{ fontSize: 10, color: 'var(--canvas-dark-ink-muted)', fontFamily: 'monospace' }}>
                    locked (voting in progress)
                  </span>
                )}
              </div>
              <DateTimePicker
                value={s.deadline}
                onChange={d => set('deadline', d)}
                disabled={!deadlineEditable}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="sf-genre" className={LABEL_CLASS} style={LABEL_STYLE}>Genre</label>
              <div style={{ position: 'relative' }}>
                <select
                  id="sf-genre"
                  value={s.genre}
                  onChange={e => set('genre', e.target.value)}
                  className="w-full h-10 pl-3.5 pr-8 text-[13px] appearance-none outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)]"
                  style={{ ...INPUT_STYLE }}
                >
                  <option value="">Any genre</option>
                  {GENRES.map(g => (
                    <option key={g} value={g}>{GENRE_LABEL[g]}</option>
                  ))}
                </select>
                <span style={SELECT_ARROW} aria-hidden>▾</span>
              </div>
            </div>
          </div>

          {/* Voting window */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 0 }}>
            <label htmlFor="sf-voting" className={LABEL_CLASS} style={LABEL_STYLE}>
              Voting window (after deadline)
            </label>
            <div style={{ position: 'relative' }}>
              <select
                id="sf-voting"
                value={s.votingDurationHours}
                onChange={e => set('votingDurationHours', parseInt(e.target.value, 10))}
                className="w-full h-10 pl-3.5 pr-8 text-[13px] appearance-none outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)]"
                style={{ ...INPUT_STYLE }}
              >
                {VOTING_DURATION_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <span style={SELECT_ARROW} aria-hidden>▾</span>
            </div>
          </div>

          <SectionDivider label="Sharing" />

          {/* Visibility */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            <span className={LABEL_CLASS} style={LABEL_STYLE}>Visibility</span>
            <VisibilityPicker
              value={s.visibility}
              onChange={handleVisibilityChange}
              options={PUBLIC_FRIENDS_PRIVATE_OPTIONS}
            />
          </div>

          {/* Discoverable */}
          <div style={{ marginBottom: 0 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 'var(--r-row)',
                background: 'rgba(255,255,255,0.025)',
                border: 'var(--br-card)',
                cursor: s.visibility === 'PUBLIC' ? 'pointer' : 'not-allowed',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={s.discoverable}
                disabled={s.visibility !== 'PUBLIC'}
                onChange={e => set('discoverable', e.target.checked)}
                className="h-4 w-4 accent-[var(--brand)] disabled:opacity-40"
              />
              <span style={{ fontSize: 13, color: 'var(--canvas-dark-ink)' }}>
                Show in Discover
              </span>
              {s.visibility !== 'PUBLIC' && (
                <span style={{ fontSize: 11, marginLeft: 'auto', color: 'var(--canvas-dark-ink-muted)' }}>
                  public sparks only
                </span>
              )}
            </label>
          </div>
        </div>

        {/* ── Sticky CTA bar ──────────────────────────── */}
        <div
          className="px-6 max-md:px-4 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch max-md:gap-2.5"
          style={{
            position: 'sticky',
            bottom: 0,
            paddingTop: 14,
            paddingBottom: 14,
            background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            borderTop: '0.5px solid rgba(255,255,255,0.06)',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.35)',
            borderRadius: '0 0 var(--r-card) var(--r-card)',
            marginTop: 20,
            zIndex: 10,
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--canvas-dark-ink-muted)' }}>
            Required:{' '}
            <span style={{ color: s.title.trim().length >= 3 ? 'var(--canvas-dark-ink)' : 'var(--brand)' }}>Title</span>
            {', '}
            <span style={{ color: s.prompt.trim().length >= 10 ? 'var(--canvas-dark-ink)' : 'var(--brand)' }}>Prompt</span>
          </span>
          <div className="flex items-center gap-2.5 max-md:w-full">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={pending}
              className="inline-flex items-center justify-center"
              style={{
                height: 38,
                padding: '0 16px',
                borderRadius: 'var(--r-pill)',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--canvas-dark-ink-muted)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center justify-center max-md:flex-1"
              style={{
                height: 38,
                padding: '0 24px',
                borderRadius: 'var(--r-pill)',
                fontSize: 13,
                fontWeight: 700,
                background: 'var(--brand)',
                color: 'var(--brand-ink)',
                border: 'none',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                opacity: canSubmit ? 1 : 0.4,
                transition: 'opacity 0.15s',
                fontFamily: 'inherit',
              }}
            >
              {pending
                ? mode === 'edit'
                  ? 'Saving…'
                  : 'Sparking…'
                : mode === 'edit'
                ? 'Save changes'
                : 'Spark it →'}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const LABEL_CLASS = 'text-[10px] font-mono uppercase tracking-[0.14em]'
const LABEL_STYLE: React.CSSProperties = { color: 'var(--canvas-dark-ink-muted)' }

const INPUT_STYLE: React.CSSProperties = {
  background: '#1E1E1E',
  boxShadow: 'var(--sh-inset)',
  color: 'var(--canvas-dark-ink)',
  borderRadius: 'var(--r-row)',
  border: 'none',
}

const SELECT_ARROW: React.CSSProperties = {
  position: 'absolute',
  right: 12,
  top: '50%',
  transform: 'translateY(-50%)',
  fontSize: 11,
  color: 'var(--canvas-dark-ink-muted)',
  pointerEvents: 'none',
}
