'use client'

import { useState, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { GENRES, GENRE_NAMES, CONTENT_WARNINGS, TARGET_AUDIENCES } from './genre-data'
import { PREDEFINED_TAGS } from './tags-data'
import {
  WizardField,
  WizardFooter,
  HelperText,
  ExampleChips,
  RECESSED_INPUT_STYLE,
  recessFocus,
  recessBlur,
} from './wizard-field'

type Step2Data = {
  genre: string
  subgenre: string
  tags: string[]
  targetAudience: string
  contentWarnings: string[]
  compTitles: string[]
  language: string
}

type Props = Step2Data & {
  onUpdate: (fields: Partial<Step2Data>) => void
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Japanese', 'Korean', 'Chinese', 'Other']

function toggleItem(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: 'var(--r-pill)',
        fontSize: 12,
        background: active
          ? 'oklch(from var(--brand) l c h / 0.12)'
          : 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        boxShadow: active ? 'none' : 'var(--sh-tile)',
        color: active ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)',
        border: active ? '1px solid oklch(from var(--brand) l c h / 0.35)' : '1px solid transparent',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function SelectField({
  value,
  onChange,
  disabled,
  children,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        onFocus={recessFocus}
        onBlur={recessBlur}
        style={{
          ...RECESSED_INPUT_STYLE,
          appearance: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
          paddingRight: 36,
        }}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        style={{
          position: 'absolute',
          right: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--canvas-dark-ink-muted)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

export function StepTwo({ genre, subgenre, tags, targetAudience, contentWarnings, compTitles, language, onUpdate, onNext, onBack, onSkip }: Props) {
  const [tagInput, setTagInput] = useState('')
  const tagInputRef = useRef<HTMLInputElement>(null)

  const subgenres = genre ? (GENRES[genre] ?? []) : []

  function addCustomTag(value: string) {
    const trimmed = value.trim()
    if (!trimmed || tags.includes(trimmed) || tags.length >= 10) return
    onUpdate({ tags: [...tags, trimmed] })
    setTagInput('')
  }

  function handleCompTitle(index: number, value: string) {
    const next = [...compTitles]
    next[index] = value
    onUpdate({ compTitles: next })
  }

  function addCompTitle() {
    if (compTitles.length < 5) onUpdate({ compTitles: [...compTitles, ''] })
  }

  function removeCompTitle(index: number) {
    onUpdate({ compTitles: compTitles.filter((_, i) => i !== index) })
  }

  function addToNextEmptyCompTitle(value: string) {
    const idx = compTitles.findIndex(t => !t.trim())
    if (idx >= 0) {
      const next = [...compTitles]
      next[idx] = value
      onUpdate({ compTitles: next })
    } else if (compTitles.length < 5) {
      onUpdate({ compTitles: [...compTitles, value] })
    }
  }

  return (
    <div className="flex flex-col" style={{ gap: 18 }}>
      {/* Genre + Subgenre */}
      <div className="grid grid-cols-2 gap-3">
        <WizardField label="Genre" optionalMarker="optional">
          <HelperText>
            Pick the one closest to your story — even if it&apos;s not a perfect fit. We use this to group your book on /discover.
          </HelperText>
          <SelectField
            value={genre}
            onChange={value => onUpdate({ genre: value, subgenre: '' })}
          >
            <option value="">Select genre…</option>
            {GENRE_NAMES.map(g => <option key={g} value={g}>{g}</option>)}
          </SelectField>
        </WizardField>
        <WizardField label="Subgenre" optionalMarker="optional">
          <SelectField
            value={subgenre}
            onChange={value => onUpdate({ subgenre: value })}
            disabled={!genre || subgenres.length === 0}
          >
            <option value="">Select subgenre…</option>
            {subgenres.map(s => <option key={s} value={s}>{s}</option>)}
          </SelectField>
        </WizardField>
      </div>

      {/* Target Audience */}
      <WizardField label="Target audience" optionalMarker="optional">
        <div className="flex flex-wrap gap-2">
          {TARGET_AUDIENCES.map(a => (
            <Chip
              key={a}
              label={a}
              active={targetAudience === a}
              onClick={() => onUpdate({ targetAudience: targetAudience === a ? '' : a })}
            />
          ))}
        </div>
      </WizardField>

      {/* Tags */}
      <WizardField label="Tags" optionalMarker={`optional · ${tags.length}/10`}>
        <HelperText>
          Short labels readers can search for — <strong>&apos;cozy&apos;</strong>, <strong>&apos;second-world fantasy&apos;</strong>, <strong>&apos;time loop&apos;</strong>. Add 1-10.
        </HelperText>
        <div className="flex flex-wrap gap-1.5">
          {PREDEFINED_TAGS.map(t => (
            <Chip
              key={t}
              label={t}
              active={tags.includes(t)}
              onClick={() => tags.length < 10 || tags.includes(t) ? onUpdate({ tags: toggleItem(tags, t) }) : undefined}
            />
          ))}
        </div>
        {/* Selected custom tags */}
        {tags.filter(t => !PREDEFINED_TAGS.includes(t)).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.filter(t => !PREDEFINED_TAGS.includes(t)).map(t => (
              <span
                key={t}
                className="inline-flex items-center gap-1"
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--r-pill)',
                  fontSize: 12,
                  background: 'oklch(from var(--brand) l c h / 0.12)',
                  color: 'var(--brand)',
                  border: '1px solid oklch(from var(--brand) l c h / 0.35)',
                }}
              >
                {t}
                <button
                  type="button"
                  onClick={() => onUpdate({ tags: tags.filter(x => x !== t) })}
                  style={{ color: 'oklch(from var(--brand) l c h / 0.6)', marginLeft: 2 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {tags.length < 10 && (
          <div className="flex gap-2">
            <input
              ref={tagInputRef}
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addCustomTag(tagInput) } }}
              placeholder="Add custom tag…"
              onFocus={recessFocus}
              onBlur={recessBlur}
              style={{ ...RECESSED_INPUT_STYLE, flex: 1, padding: '8px 12px', fontSize: 13 }}
            />
            <button
              type="button"
              onClick={() => addCustomTag(tagInput)}
              className="text-[12px] text-brand border border-brand/30 rounded-lg px-3 py-2 hover:bg-brand/10 transition-colors"
            >
              Add
            </button>
          </div>
        )}
      </WizardField>

      {/* Content Warnings */}
      <WizardField label="Content warnings" optionalMarker="optional">
        <div className="flex flex-wrap gap-1.5">
          {CONTENT_WARNINGS.map(w => (
            <Chip
              key={w}
              label={w}
              active={contentWarnings.includes(w)}
              onClick={() => onUpdate({ contentWarnings: toggleItem(contentWarnings, w) })}
            />
          ))}
        </div>
      </WizardField>

      {/* Comp Titles */}
      <WizardField label="Comparable titles" optionalMarker="optional · up to 5">
        <HelperText>
          Books that share a vibe with yours. &apos;My book is <em>Howl&apos;s Moving Castle</em> meets <em>Gormenghast</em>&apos; — readers love these. You can add up to 5.
        </HelperText>
        <div className="flex flex-col gap-2">
          {compTitles.map((t, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="Readers who liked…"
                value={t}
                onChange={e => handleCompTitle(i, e.target.value)}
                onFocus={recessFocus}
                onBlur={recessBlur}
                style={{ ...RECESSED_INPUT_STYLE, flex: 1, padding: '9px 14px' }}
              />
              {compTitles.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCompTitle(i)}
                  className="text-white/30 hover:text-white/60 px-2 transition-colors text-[18px] leading-none"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {compTitles.length < 5 && compTitles[compTitles.length - 1] !== '' && (
            <button type="button" onClick={addCompTitle} className="text-[12px] text-brand/70 hover:text-brand transition-colors self-start">
              + Add another title
            </button>
          )}
        </div>
        <ExampleChips
          examples={["Piranesi", "House of Leaves", "The Night Circus"]}
          onPick={addToNextEmptyCompTitle}
          ariaLabelPrefix="Use comp title"
        />
      </WizardField>

      {/* Language */}
      <WizardField label="Language" optionalMarker="optional">
        <SelectField
          value={language}
          onChange={value => onUpdate({ language: value })}
        >
          <option value="">Select language…</option>
          {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
        </SelectField>
      </WizardField>

      <WizardFooter
        onBack={onBack}
        onSkip={onSkip}
        onNext={onNext}
        nextLabel="Next: shape your manuscript →"
      />
    </div>
  )
}
