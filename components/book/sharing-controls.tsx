'use client'

import { Lock, Users, Globe, Check } from 'lucide-react'

export type Visibility = 'PRIVATE' | 'PUBLIC' | 'FRIENDS'

type Props = {
  visibility: Visibility
  discoverable: boolean
  onChange: (next: { visibility?: Visibility; discoverable?: boolean }) => void
}

const OPTIONS: Array<{
  value: Visibility
  title: string
  description: string
  icon: typeof Lock
  hint?: string
}> = [
  { value: 'PRIVATE', title: 'Private', description: 'Only you can read this book.', icon: Lock },
  { value: 'FRIENDS', title: 'Friends only', description: 'You and your friends on Beehive.', icon: Users, hint: 'Requires a friend on Beehive (coming soon)' },
  { value: 'PUBLIC', title: 'Public', description: 'Anyone with the link can read this book.', icon: Globe },
]

export function SharingControls({ visibility, discoverable, onChange }: Props) {
  const isPublic = visibility === 'PUBLIC'
  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-3">
        {OPTIONS.map(opt => {
          const Icon = opt.icon
          const selected = visibility === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ visibility: opt.value })}
              style={{
                textAlign: 'left',
                padding: 14,
                borderRadius: 18,
                background: selected
                  ? 'oklch(from var(--brand) l c h / 0.12)'
                  : 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                boxShadow: selected ? 'none' : 'var(--sh-tile)',
                border: selected
                  ? '1px solid oklch(from var(--brand) l c h / 0.45)'
                  : '1px solid transparent',
                color: 'var(--canvas-dark-ink-strong)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              <Icon
                size={16}
                style={{
                  color: selected ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)',
                  marginBottom: 8,
                }}
              />
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {opt.title}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--canvas-dark-ink-muted)',
                  marginTop: 2,
                }}
              >
                {opt.description}
              </div>
              {opt.hint && (
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--canvas-dark-ink-muted)',
                    opacity: 0.7,
                    marginTop: 6,
                  }}
                >
                  {opt.hint}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: 14,
          borderRadius: 'var(--r-row)',
          background: 'var(--canvas-dark-100)',
          boxShadow: 'var(--sh-inset)',
          cursor: isPublic ? 'pointer' : 'not-allowed',
          opacity: isPublic ? 1 : 0.45,
          transition: 'opacity 150ms ease',
        }}
      >
        <input
          type="checkbox"
          checked={discoverable && isPublic}
          disabled={!isPublic}
          onChange={(e) => onChange({ discoverable: e.target.checked })}
          className="sr-only"
          aria-describedby="discoverable-help"
        />
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center"
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            marginTop: 1,
            background:
              discoverable && isPublic ? 'var(--brand)' : 'var(--canvas-dark-100)',
            border:
              discoverable && isPublic
                ? 'none'
                : '1px solid oklch(1 0 0 / 0.10)',
            color: 'var(--brand-ink)',
            flexShrink: 0,
          }}
        >
          {discoverable && isPublic && <Check size={13} strokeWidth={3} />}
        </span>
        <div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--canvas-dark-ink-strong)',
            }}
          >
            Discoverable
          </div>
          <div
            id="discoverable-help"
            style={{
              fontSize: 11,
              color: 'var(--canvas-dark-ink-muted)',
              marginTop: 2,
            }}
          >
            {isPublic
              ? 'Discoverable books show up on /discover. Uncheck if you want a public-but-unlisted link only.'
              : 'Only public books can be discoverable.'}
          </div>
        </div>
      </label>
    </div>
  )
}
