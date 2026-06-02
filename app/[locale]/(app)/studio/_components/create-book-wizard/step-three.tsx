'use client'

import { Check } from 'lucide-react'
import { TRIM_SIZES } from './genre-data'
import { HelperText, RECESSED_INPUT_STYLE, WizardFooter, recessBlur, recessFocus } from './wizard-field'

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
  onNext: () => void
  error: string | null
}

const TILE_IDLE_BG = 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))'
const TILE_IDLE_BORDER = '1px solid transparent'
const TILE_ACTIVE_BG = 'oklch(from var(--brand) l c h / 0.12)'
const TILE_ACTIVE_BORDER = '1px solid oklch(from var(--brand) l c h / 0.45)'

function StructureCard({
  active,
  title,
  helper,
  onClick,
  children,
}: {
  active: boolean
  title: string
  helper: string
  onClick: () => void
  children?: React.ReactNode
}) {
  return (
    <div
      style={{
        background: active ? TILE_ACTIVE_BG : TILE_IDLE_BG,
        border: active ? TILE_ACTIVE_BORDER : TILE_IDLE_BORDER,
        boxShadow: 'var(--sh-tile)',
        borderRadius: 18,
        padding: '16px 18px',
        transition: 'background 150ms ease, border-color 150ms ease',
      }}
    >
      <button
        type="button"
        onClick={onClick}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '14px',
              fontWeight: 600,
              color: active ? 'var(--brand)' : 'var(--canvas-dark-ink-strong)',
            }}
          >
            {title}
          </span>
          <span
            style={{
              fontSize: '12px',
              lineHeight: 1.5,
              color: 'var(--canvas-dark-ink-muted)',
            }}
          >
            {helper}
          </span>
        </div>
        {active && (
          <Check size={18} style={{ color: 'var(--brand)', flexShrink: 0, marginTop: 2 }} />
        )}
      </button>
      {children}
    </div>
  )
}

function TemplateTile({
  template,
  active,
  onClick,
}: {
  template: BookTemplate
  active: boolean
  onClick: () => void
}) {
  const initial = template.name.trim().charAt(0).toUpperCase() || '?'
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? TILE_ACTIVE_BG : TILE_IDLE_BG,
        border: active ? TILE_ACTIVE_BORDER : TILE_IDLE_BORDER,
        boxShadow: 'var(--sh-tile)',
        borderRadius: 18,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'background 150ms ease, border-color 150ms ease',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: active
            ? 'oklch(from var(--brand) l c h / 0.22)'
            : 'oklch(1 0 0 / 0.04)',
          color: active ? 'var(--brand)' : 'var(--canvas-dark-ink-strong)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-display)',
          fontSize: 14,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {initial}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 2, minWidth: 0 }}>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '13.5px',
            fontWeight: 600,
            color: active ? 'var(--brand)' : 'var(--canvas-dark-ink-strong)',
          }}
        >
          {template.name}
        </span>
        {template.genre && (
          <span
            style={{
              fontSize: '11.5px',
              color: 'var(--canvas-dark-ink-muted)',
            }}
          >
            {template.genre}
          </span>
        )}
      </div>
      {active && (
        <Check size={18} style={{ color: 'var(--brand)', flexShrink: 0 }} />
      )}
    </button>
  )
}

export function StepThree({ templateId, isSeriesBook, seriesName, seriesNumber, publisherName, trimSize, edition, templates, onUpdate, onBack, onSkip, onNext, error }: Props) {
  return (
    <div className="space-y-5">
      {/* Structure — centered + widened (full inner width) */}
      <div className="flex flex-col gap-3 mx-auto" style={{ maxWidth: 640, width: '100%' }}>
        <HelperText>Pick a structure for your manuscript.</HelperText>
        <StructureCard
          active={!isSeriesBook}
          title="Standalone"
          helper="One self-contained story. Most novels live here."
          onClick={() => onUpdate({ isSeriesBook: false })}
        />
        <StructureCard
          active={isSeriesBook}
          title="Part of a series"
          helper="Linked to other books with prev/next navigation on the reader page."
          onClick={() => onUpdate({ isSeriesBook: true })}
        >
          {isSeriesBook && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p
                style={{
                  fontSize: '12px',
                  lineHeight: 1.5,
                  color: 'var(--canvas-dark-ink-muted)',
                  margin: 0,
                }}
              >
                If you&apos;re writing the second book of <em>The Stormlight Archive</em>, name the series and put <strong>&lsquo;2&rsquo;</strong> here. We&apos;ll show prev/next links on the reader page.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <input
                  type="text"
                  placeholder="Series name"
                  aria-label="Series name"
                  value={seriesName}
                  onChange={e => onUpdate({ seriesName: e.target.value })}
                  onFocus={recessFocus}
                  onBlur={recessBlur}
                  style={RECESSED_INPUT_STYLE}
                />
                <input
                  type="number"
                  min={1}
                  max={9999}
                  placeholder="Book #"
                  aria-label="Book number"
                  value={seriesNumber}
                  onChange={e => onUpdate({ seriesNumber: e.target.value })}
                  onFocus={recessFocus}
                  onBlur={recessBlur}
                  style={RECESSED_INPUT_STYLE}
                />
              </div>
            </div>
          )}
        </StructureCard>
      </div>

      {/* Template — full width below */}
      <div className="flex flex-col gap-2 mt-5">
        {templates.map(t => (
          <TemplateTile
            key={t.id}
            template={t}
            active={templateId === t.id}
            onClick={() => onUpdate({ templateId: templateId === t.id ? '' : t.id })}
          />
        ))}
      </div>

      {/* Publisher info — collapsible, full width */}
      <details
        className="mt-5 group"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          boxShadow: 'var(--sh-tile)',
          borderRadius: 16,
          padding: '14px 18px',
          border: '1px solid transparent',
        }}
      >
        <summary
          className="uppercase cursor-pointer list-none flex items-center justify-between"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: 'var(--canvas-dark-ink-muted)',
          }}
        >
          <span>Publisher info — optional</span>
          <span
            aria-hidden
            className="transition-transform group-open:rotate-90"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            ›
          </span>
        </summary>
        <div className="space-y-3" style={{ marginTop: 14 }}>
          <input
            type="text"
            placeholder="Publisher name (e.g. Tor Books)"
            aria-label="Publisher name"
            value={publisherName}
            onChange={e => onUpdate({ publisherName: e.target.value })}
            onFocus={recessFocus}
            onBlur={recessBlur}
            style={RECESSED_INPUT_STYLE}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <select
              value={trimSize}
              onChange={e => onUpdate({ trimSize: e.target.value })}
              onFocus={recessFocus}
              onBlur={recessBlur}
              aria-label="Trim size"
              style={{ ...RECESSED_INPUT_STYLE, appearance: 'none', cursor: 'pointer' }}
            >
              <option value="">Trim size…</option>
              {TRIM_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
              type="text"
              placeholder="Edition (e.g. First Edition)"
              aria-label="Edition"
              value={edition}
              onChange={e => onUpdate({ edition: e.target.value })}
              onFocus={recessFocus}
              onBlur={recessBlur}
              style={RECESSED_INPUT_STYLE}
            />
          </div>
        </div>
      </details>

      {error && (
        <p
          style={{
            fontSize: 13,
            color: 'oklch(0.72 0.21 25)',
            background: 'oklch(0.62 0.21 25 / 0.10)',
            border: '1px solid oklch(0.62 0.21 25 / 0.25)',
            borderRadius: 'var(--r-row)',
            padding: '12px 16px',
          }}
        >
          {error === 'FREE_LIMIT_REACHED'
            ? "You've reached the free plan limit of 3 books. Upgrade to create more."
            : error}
        </p>
      )}

      <WizardFooter
        onBack={onBack}
        onSkip={onSkip}
        onNext={onNext}
        nextLabel="Next: who can see it →"
      />
    </div>
  )
}
