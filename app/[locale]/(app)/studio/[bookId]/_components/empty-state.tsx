'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type CtaProps = { label: string; onClick: () => void; variant?: 'primary' | 'secondary'; disabled?: boolean }

type Props = {
  icon?: ReactNode
  title: string
  body?: string | ReactNode
  cta?: CtaProps
  secondaryCta?: { label: string; onClick: () => void }
  className?: string
  /** Set when the empty state lives on editor canvas (not chrome). Applies
   *  theme-aware ink colors that flip with the editor light/dark toggle. */
  onEditorCanvas?: boolean
}

export function EmptyState({
  icon,
  title,
  body,
  cta,
  secondaryCta,
  className,
  onEditorCanvas = false,
}: Props) {
  return (
    <div
      data-slot="empty-state"
      className={cn('flex-1 flex items-center justify-center p-8', className)}
      style={
        onEditorCanvas
          ? undefined
          : {
              background:
                'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
              borderRadius: 'var(--r-card)',
              boxShadow: 'var(--sh-card)',
              border: 'var(--br-card)',
            }
      }
    >
      {onEditorCanvas && (
        <style>{`
          [data-slot="empty-state"] {
            --es-ink:       var(--canvas-dark-ink);
            --es-ink-strong:var(--canvas-dark-ink-strong);
            --es-ink-muted: var(--canvas-dark-ink-muted);
          }
          [data-editor-theme="light"] [data-slot="empty-state"] {
            --es-ink:       var(--paper-ink-strong);
            --es-ink-strong:var(--paper-ink-strong);
            --es-ink-muted: var(--paper-ink);
          }
        `}</style>
      )}
      <div className="text-center max-w-sm flex flex-col items-center gap-3">
        {icon && (
          <div
            className="w-12 h-12 rounded-full inline-flex items-center justify-center"
            style={{
              background: 'oklch(from var(--color-brand) l c h / 0.12)',
              color: 'var(--color-brand)',
            }}
          >
            {icon}
          </div>
        )}
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: onEditorCanvas ? 'var(--es-ink-strong)' : 'var(--foreground)',
          }}
        >
          {title}
        </h2>
        {body && (
          <p
            className="text-sm leading-relaxed"
            style={{
              color: onEditorCanvas ? 'var(--es-ink-muted)' : 'var(--muted-foreground)',
            }}
          >
            {body}
          </p>
        )}
        {(cta || secondaryCta) && (
          <div className="flex items-center gap-2 mt-2">
            {cta && (
              <button
                onClick={cta.onClick}
                disabled={cta.disabled}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50',
                  (cta.variant ?? 'primary') === 'primary'
                    ? 'bg-brand text-brand-ink hover:bg-brand-hover'
                    : 'border border-border text-foreground hover:bg-surface-elevated',
                )}
              >
                {cta.label}
              </button>
            )}
            {secondaryCta && (
              <button
                onClick={secondaryCta.onClick}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {secondaryCta.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
