'use client'

import { Globe, Users, Lock } from 'lucide-react'
import type { SparkVisibility } from '@/db/schema/social'

type Props = {
  value: SparkVisibility
  onChange: (next: SparkVisibility) => void
}

const OPTIONS: Array<{ value: SparkVisibility; label: string; icon: typeof Globe; blurb: string }> = [
  { value: 'PUBLIC', label: 'Public', icon: Globe, blurb: 'Anyone can see and enter.' },
  { value: 'FRIENDS', label: 'Friends', icon: Users, blurb: 'Only your friends can see and enter.' },
  { value: 'PRIVATE', label: 'Private', icon: Lock, blurb: 'Only you can see this spark.' },
]

export function VisibilityPicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {OPTIONS.map((opt) => {
        const Icon = opt.icon
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`text-left p-3 rounded-[var(--r-card)] border transition-colors ${
              active
                ? 'border-[var(--brand)] bg-[color-mix(in_oklch,var(--brand)_8%,transparent)]'
                : 'border-[var(--br-card)] hover:border-[var(--canvas-dark-ink-muted)]'
            }`}
          >
            <Icon className="h-4 w-4 mb-2 text-[var(--brand)]" />
            <div className="font-semibold text-sm">{opt.label}</div>
            <div className="text-xs text-[var(--canvas-dark-ink-muted)] mt-1">{opt.blurb}</div>
          </button>
        )
      })}
    </div>
  )
}
