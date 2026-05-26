'use client'

import { CheckCircle2, AlertCircle, Info, Sparkles, X } from 'lucide-react'
import { useBookEditor } from './book-editor-provider'

type ToastVariant = 'info' | 'success' | 'error' | 'premium'

type ToastVisual = {
  icon: typeof Info
  iconColor: string
  tint: string
  ring: string
}

// Variant-specific visual treatment. Each variant rides the paper-card base
// (bg-card, border, shadow-md, rounded-md) and only overrides the tint stripe
// at left and the icon color — keeps the surface consistent across variants.
const VARIANT_VISUALS: Record<ToastVariant, ToastVisual> = {
  info: {
    icon: Info,
    iconColor: 'var(--chrome-300)',
    tint: 'var(--chrome-700)',
    ring: 'oklch(from var(--chrome-700) l c h / 0.5)',
  },
  success: {
    icon: CheckCircle2,
    iconColor: 'var(--success)',
    tint: 'var(--success)',
    ring: 'oklch(from var(--success) l c h / 0.4)',
  },
  error: {
    icon: AlertCircle,
    iconColor: 'var(--error)',
    tint: 'var(--error)',
    ring: 'oklch(from var(--error) l c h / 0.4)',
  },
  premium: {
    icon: Sparkles,
    iconColor: 'var(--brand)',
    tint: 'var(--brand)',
    ring: 'oklch(from var(--brand) l c h / 0.4)',
  },
}

function Toast({
  variant,
  message,
  onDismiss,
}: {
  variant: ToastVariant
  message: string
  onDismiss?: () => void
}) {
  const visual = VARIANT_VISUALS[variant]
  const Icon = visual.icon
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className="flex items-start gap-2.5 bg-card border border-border rounded-md shadow-md p-3 text-sm text-foreground"
      style={{ borderLeftWidth: '3px', borderLeftColor: visual.tint, boxShadow: `0 4px 16px ${visual.ring}` }}
    >
      <Icon size={16} className="mt-0.5 flex-shrink-0" style={{ color: visual.iconColor }} />
      <span className="flex-1 leading-snug">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors mt-0.5 leading-none flex-shrink-0"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

export function ErrorToasts() {
  const { errors, dismissError, flashes } = useBookEditor()

  if (errors.length === 0 && flashes.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 max-w-sm">
      {flashes.map((msg, i) => (
        <Toast key={`flash-${i}`} variant="success" message={msg} />
      ))}
      {errors.map((error, i) => (
        <Toast
          key={`err-${i}`}
          variant="error"
          message={error}
          onDismiss={() => dismissError(i)}
        />
      ))}
    </div>
  )
}
