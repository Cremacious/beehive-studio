'use client'

import { Lock, Users, Globe } from 'lucide-react'

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
              className={`text-left p-3 rounded-xl border transition-colors
                ${selected
                  ? 'border-brand/50 bg-brand/10 text-white'
                  : 'border-border bg-[#1c1c1c] text-white/60 hover:border-white/20 hover:text-white/80'
                }`}
            >
              <Icon className={`w-4 h-4 mb-2 ${selected ? 'text-brand' : 'text-white/40'}`} />
              <div className="text-[13px] font-medium text-white">{opt.title}</div>
              <div className="text-[11px] text-white/45 mt-0.5">{opt.description}</div>
              {opt.hint && <div className="text-[10px] text-white/30 mt-1.5">{opt.hint}</div>}
            </button>
          )
        })}
      </div>

      <div
        className={`p-4 rounded-xl border transition-colors ${
          isPublic ? 'border-border bg-[#1c1c1c]' : 'border-border/60 bg-[#161616]'
        }`}
      >
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={discoverable && isPublic}
            disabled={!isPublic}
            onChange={(e) => onChange({ discoverable: e.target.checked })}
            className="mt-0.5 accent-brand"
          />
          <div className="flex-1">
            <div className={`text-[13px] font-medium ${isPublic ? 'text-white' : 'text-white/35'}`}>
              Discoverable
            </div>
            <div className={`text-[11px] mt-0.5 ${isPublic ? 'text-white/55' : 'text-white/30'}`}>
              {isPublic
                ? 'Show this book on the Discover page so other writers can find it.'
                : 'Only public books can be discoverable.'}
            </div>
          </div>
        </label>
      </div>
    </div>
  )
}
