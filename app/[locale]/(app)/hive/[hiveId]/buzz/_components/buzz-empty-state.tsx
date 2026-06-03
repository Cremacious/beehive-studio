'use client'

import { Sparkles } from 'lucide-react'

export function BuzzEmptyState({ canPost }: { canPost: boolean }) {
  return (
    <div className="text-center py-12 flex flex-col items-center gap-3">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{
          background: 'oklch(from var(--brand) l c h / 0.14)',
          color: 'var(--brand)',
        }}
      >
        <Sparkles size={22} />
      </div>
      <p
        className="font-comfortaa font-semibold text-base"
        style={{ color: 'var(--canvas-dark-ink-strong)' }}
      >
        No buzz yet
      </p>
      <p
        className="text-sm"
        style={{ color: 'var(--canvas-dark-ink-muted)' }}
      >
        {canPost
          ? 'Be the first to share something with the hive.'
          : 'Nothing here yet.'}
      </p>
    </div>
  )
}
