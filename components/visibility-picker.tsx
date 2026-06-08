'use client'

import { Globe, Users, Lock } from 'lucide-react'

export type VisibilityOption<T extends string> = {
  value: T
  label: string
  blurb: string
  icon: typeof Globe
}

type Props<T extends string> = {
  value: T
  onChange: (next: T) => void
  options: VisibilityOption<T>[]
}

/**
 * Map of the canonical 3-value visibility enum to its `--list-visibility-*`
 * accent token. Picker consumers passing the canonical
 * `PUBLIC_FRIENDS_PRIVATE_OPTIONS` get per-tier color feedback when active;
 * exotic option sets fall back to `--brand`.
 */
const SELECTED_TOKEN_MAP: Record<string, string> = {
  PUBLIC: 'var(--list-visibility-public)',
  FRIENDS: 'var(--list-visibility-friends)',
  PRIVATE: 'var(--list-visibility-private)',
}

export function VisibilityPicker<T extends string>({ value, onChange, options }: Props<T>) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((opt) => {
        const Icon = opt.icon
        const active = value === opt.value
        const tierColor = SELECTED_TOKEN_MAP[opt.value] ?? 'var(--brand)'
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`text-left p-3 rounded-[var(--r-card)] border transition-colors ${
              active ? '' : 'border-[var(--br-card)] hover:border-[var(--canvas-dark-ink-muted)]'
            }`}
            style={
              active
                ? {
                    borderColor: tierColor,
                    background: `oklch(from ${tierColor} l c h / 0.12)`,
                    boxShadow: `0 0 0 1px ${tierColor}`,
                  }
                : undefined
            }
          >
            <Icon
              className="h-4 w-4 mb-2"
              style={{ color: active ? tierColor : 'var(--canvas-dark-ink-muted)' }}
            />
            <div
              className="font-semibold text-sm"
              style={active ? { color: tierColor } : undefined}
            >
              {opt.label}
            </div>
            <div className="text-xs text-[var(--canvas-dark-ink-muted)] mt-1">{opt.blurb}</div>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Shared option set for the canonical 3-value `'PUBLIC' | 'FRIENDS' | 'PRIVATE'` enum literal
 * shared by SparkVisibility, BookVisibility, and book club visibility.
 */
export const PUBLIC_FRIENDS_PRIVATE_OPTIONS: VisibilityOption<'PUBLIC' | 'FRIENDS' | 'PRIVATE'>[] = [
  { value: 'PUBLIC', label: 'Public', icon: Globe, blurb: 'Anyone can see.' },
  { value: 'FRIENDS', label: 'Friends', icon: Users, blurb: 'Only your friends can see.' },
  { value: 'PRIVATE', label: 'Private', icon: Lock, blurb: 'Only you can see.' },
]
