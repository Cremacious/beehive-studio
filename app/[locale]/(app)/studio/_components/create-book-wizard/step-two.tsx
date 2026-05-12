'use client'

import { useState, useRef } from 'react'
import { GENRES, GENRE_NAMES, CONTENT_WARNINGS, TARGET_AUDIENCES } from './genre-data'
import { PREDEFINED_TAGS } from './tags-data'

const field = 'w-full bg-[#1c1c1c] border border-border rounded-xl px-4 py-3 text-[14px] text-white placeholder:text-white/25 focus:outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/10 transition-all'
const label = 'block text-[12px] font-medium text-white/60 mb-1.5'
const selectClass = `${field} appearance-none cursor-pointer`

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
      className={`px-3 py-1 rounded-full text-[12px] border transition-colors
        ${active
          ? 'bg-brand/15 border-brand/40 text-brand'
          : 'bg-[#1c1c1c] border-border text-white/50 hover:border-white/20 hover:text-white/70'
        }`}
    >
      {label}
    </button>
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

  return (
    <div className="space-y-5">
      {/* Genre + Subgenre */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Genre</label>
          <select
            value={genre}
            onChange={e => { onUpdate({ genre: e.target.value, subgenre: '' }) }}
            className={selectClass}
          >
            <option value="">Select genre…</option>
            {GENRE_NAMES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Subgenre</label>
          <select
            value={subgenre}
            onChange={e => onUpdate({ subgenre: e.target.value })}
            disabled={!genre || subgenres.length === 0}
            className={`${selectClass} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <option value="">Select subgenre…</option>
            {subgenres.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Target Audience */}
      <div>
        <label className={label}>Target audience</label>
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
      </div>

      {/* Tags */}
      <div>
        <label className={label}>Tags <span className="text-white/30 font-normal">({tags.length}/10)</span></label>
        <div className="flex flex-wrap gap-1.5 mb-2">
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
        {tags.filter(t => !PREDEFINED_TAGS.includes(t)).map(t => (
          <span key={t} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] bg-brand/15 border border-brand/40 text-brand mr-1.5 mb-1.5">
            {t}
            <button type="button" onClick={() => onUpdate({ tags: tags.filter(x => x !== t) })} className="text-brand/60 hover:text-brand ml-0.5">×</button>
          </span>
        ))}
        {tags.length < 10 && (
          <div className="flex gap-2 mt-2">
            <input
              ref={tagInputRef}
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addCustomTag(tagInput) } }}
              placeholder="Add custom tag…"
              className="flex-1 bg-[#1c1c1c] border border-border rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-white/25 focus:outline-none focus:border-brand/40 transition-all"
            />
            <button type="button" onClick={() => addCustomTag(tagInput)} className="text-[12px] text-brand border border-brand/30 rounded-lg px-3 py-2 hover:bg-brand/10 transition-colors">Add</button>
          </div>
        )}
      </div>

      {/* Content Warnings */}
      <div>
        <label className={label}>Content warnings</label>
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
      </div>

      {/* Comp Titles */}
      <div>
        <label className={label}>Comparable titles <span className="text-white/30 font-normal">optional · up to 5</span></label>
        <div className="space-y-2">
          {compTitles.map((t, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                placeholder={`Readers who liked…`}
                value={t}
                onChange={e => handleCompTitle(i, e.target.value)}
                className="flex-1 bg-[#1c1c1c] border border-border rounded-xl px-4 py-2.5 text-[14px] text-white placeholder:text-white/25 focus:outline-none focus:border-brand/50 transition-all"
              />
              {compTitles.length > 1 && (
                <button type="button" onClick={() => removeCompTitle(i)} className="text-white/30 hover:text-white/60 px-2 transition-colors text-[18px] leading-none">×</button>
              )}
            </div>
          ))}
          {compTitles.length < 5 && compTitles[compTitles.length - 1] !== '' && (
            <button type="button" onClick={addCompTitle} className="text-[12px] text-brand/70 hover:text-brand transition-colors">+ Add another title</button>
          )}
        </div>
      </div>

      {/* Language */}
      <div>
        <label className={label}>Language</label>
        <select value={language} onChange={e => onUpdate({ language: e.target.value })} className={selectClass}>
          <option value="">Select language…</option>
          {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onBack} className="text-[13px] text-white/40 hover:text-white/70 transition-colors">← Back</button>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onSkip} className="text-[13px] text-white/40 hover:text-white/70 transition-colors">Skip</button>
          <button
            type="button"
            onClick={onNext}
            className="bg-brand text-[#0a0a0a] font-bold font-comfortaa rounded-full px-6 py-2.5 text-[13px] hover:bg-brand-hover hover:-translate-y-px transition-all"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}
