'use client'

import type { ReactNode } from 'react'

type WizardFieldProps = {
  label: string
  required?: boolean
  optionalMarker?: string
  helperId?: string
  children: ReactNode
}

export function WizardField({ label, required, optionalMarker, children }: WizardFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <label
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--canvas-dark-ink-strong)',
          }}
        >
          {label}
          {required && <span style={{ color: 'var(--brand)', marginLeft: 4 }}>*</span>}
        </label>
        {optionalMarker && (
          <span
            className="uppercase"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.08em',
              color: 'var(--canvas-dark-ink-muted)',
            }}
          >
            {optionalMarker}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

type HelperTextProps = {
  id?: string
  children: ReactNode
}

export function HelperText({ id, children }: HelperTextProps) {
  return (
    <p
      id={id}
      style={{
        fontSize: '12px',
        lineHeight: 1.5,
        color: 'var(--canvas-dark-ink-muted)',
        margin: 0,
      }}
    >
      {children}
    </p>
  )
}

type ExampleChipsProps = {
  examples: string[]
  onPick: (value: string) => void
  ariaLabelPrefix?: string
}

export function ExampleChips({ examples, onPick, ariaLabelPrefix = 'Use example' }: ExampleChipsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap mt-1">
      <span
        className="uppercase"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9.5px',
          letterSpacing: '0.1em',
          color: 'var(--canvas-dark-ink-muted)',
        }}
      >
        try one:
      </span>
      {examples.map(ex => (
        <button
          key={ex}
          type="button"
          onClick={() => onPick(ex)}
          aria-label={`${ariaLabelPrefix}: ${ex}`}
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            boxShadow: 'var(--sh-tile)',
            borderRadius: 'var(--r-pill)',
            padding: '4px 12px',
            fontFamily: 'var(--font-prose)',
            fontStyle: 'italic',
            fontSize: '12.5px',
            color: 'var(--canvas-dark-ink)',
            cursor: 'pointer',
            transition: 'transform 150ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
        >
          {ex}
        </button>
      ))}
    </div>
  )
}

export const RECESSED_INPUT_STYLE = {
  background: 'var(--canvas-dark-100)',
  border: '1px solid oklch(1 0 0 / 0.06)',
  borderRadius: 'var(--r-row)',
  padding: '10px 14px',
  fontFamily: 'var(--font-sans)',
  fontSize: '14px',
  color: 'var(--canvas-dark-ink-strong)',
  width: '100%',
  transition: 'border-color 150ms ease, box-shadow 150ms ease',
} as const

export const RECESSED_TEXTAREA_STYLE = {
  ...RECESSED_INPUT_STYLE,
  background: 'oklch(0.245 0.003 256)',
} as const

export function recessFocus(e: React.FocusEvent<HTMLElement>) {
  e.currentTarget.style.boxShadow = '0 0 0 3px oklch(from var(--brand) l c h / 0.18)'
  e.currentTarget.style.borderColor = 'var(--brand)'
}

export function recessBlur(e: React.FocusEvent<HTMLElement>) {
  e.currentTarget.style.boxShadow = 'none'
  e.currentTarget.style.borderColor = 'oklch(1 0 0 / 0.06)'
}
