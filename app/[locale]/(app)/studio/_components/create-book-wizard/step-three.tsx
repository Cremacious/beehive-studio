'use client'

import { TRIM_SIZES } from './genre-data'

const field = 'w-full bg-[#1c1c1c] border border-border rounded-xl px-4 py-3 text-[14px] text-white placeholder:text-white/25 focus:outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/10 transition-all'
const label = 'block text-[12px] font-medium text-white/60 mb-1.5'
const selectClass = `${field} appearance-none cursor-pointer`

export type BookTemplate = {
  id: string
  name: string
  genre: string | null
}

type Step3Data = {
  templateId: string
  isSeriesBook: boolean
  seriesName: string
  seriesNumber: string
  publisherName: string
  trimSize: string
  edition: string
}

type Props = Step3Data & {
  templates: BookTemplate[]
  onUpdate: (fields: Partial<Step3Data>) => void
  onBack: () => void
  onSkip: () => void
  onSubmit: () => void
  submitting: boolean
  error: string | null
}

export function StepThree({ templateId, isSeriesBook, seriesName, seriesNumber, publisherName, trimSize, edition, templates, onUpdate, onBack, onSkip, onSubmit, submitting, error }: Props) {
  return (
    <div className="space-y-5">
      {/* Template selector */}
      <div>
        <label className={label}>Template</label>
        <div className="grid grid-cols-2 gap-2">
          {templates.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => onUpdate({ templateId: templateId === t.id ? '' : t.id })}
              className={`text-left p-3 rounded-xl border transition-colors
                ${templateId === t.id
                  ? 'border-brand/50 bg-brand/10 text-white'
                  : 'border-border bg-[#1c1c1c] text-white/60 hover:border-white/20 hover:text-white/80'
                }`}
            >
              <div className="text-[13px] font-medium">{t.name}</div>
              {t.genre && <div className="text-[11px] text-white/35 mt-0.5">{t.genre}</div>}
            </button>
          ))}
        </div>
      </div>

      {/* Series */}
      <div>
        <label className={label}>Series</label>
        <div className="flex gap-2 mb-3">
          {(['Standalone', 'Series'] as const).map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => onUpdate({ isSeriesBook: opt === 'Series' })}
              className={`flex-1 py-2.5 rounded-xl border text-[13px] font-medium transition-colors
                ${(opt === 'Series') === isSeriesBook
                  ? 'border-brand/50 bg-brand/10 text-brand'
                  : 'border-border bg-[#1c1c1c] text-white/50 hover:border-white/20'
                }`}
            >
              {opt}
            </button>
          ))}
        </div>
        {isSeriesBook && (
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={label}>Series name</label>
              <input
                type="text"
                placeholder="e.g. The Stormlight Archive"
                value={seriesName}
                onChange={e => onUpdate({ seriesName: e.target.value })}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Book #</label>
              <input
                type="number"
                min={1}
                max={9999}
                placeholder="1"
                value={seriesNumber}
                onChange={e => onUpdate({ seriesNumber: e.target.value })}
                className={field}
              />
            </div>
          </div>
        )}
      </div>

      {/* Publisher info */}
      <div>
        <div className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-3">Publisher info — optional</div>
        <div className="space-y-3">
          <div>
            <label className={label}>Publisher name</label>
            <input
              type="text"
              placeholder="e.g. Tor Books"
              value={publisherName}
              onChange={e => onUpdate({ publisherName: e.target.value })}
              className={field}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Trim size</label>
              <select value={trimSize} onChange={e => onUpdate({ trimSize: e.target.value })} className={selectClass}>
                <option value="">Select…</option>
                {TRIM_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Edition</label>
              <input
                type="text"
                placeholder="First Edition"
                value={edition}
                onChange={e => onUpdate({ edition: e.target.value })}
                className={field}
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
          {error === 'FREE_LIMIT_REACHED'
            ? "You've reached the free plan limit of 3 books. Upgrade to create more."
            : error}
        </p>
      )}

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onBack} className="text-[13px] text-white/40 hover:text-white/70 transition-colors">← Back</button>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onSkip} disabled={submitting} className="text-[13px] text-white/40 hover:text-white/70 transition-colors disabled:opacity-40">Skip</button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="bg-brand text-[#0a0a0a] font-bold font-comfortaa rounded-full px-6 py-2.5 text-[13px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-hover hover:-translate-y-px transition-all"
          >
            {submitting ? 'Creating…' : 'Create Book'}
          </button>
        </div>
      </div>
    </div>
  )
}
