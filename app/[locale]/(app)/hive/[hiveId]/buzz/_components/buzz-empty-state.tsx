'use client'

import { Plus, Sparkles } from 'lucide-react'

export function BuzzEmptyState({
  canPost,
  onCompose,
}: {
  canPost: boolean
  onCompose: () => void
}) {
  return (
    <div
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-tile)',
        border: 'var(--br-card)',
      }}
      className="px-6 py-12 text-center"
    >
      <div
        className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4"
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
        className="text-sm mt-1"
        style={{ color: 'var(--canvas-dark-ink-muted)' }}
      >
        Be the first to share something with the hive.
      </p>
      {canPost && (
        <button
          type="button"
          onClick={onCompose}
          style={{
            background: 'var(--brand)',
            color: 'var(--brand-ink, oklch(0.18 0.02 60))',
            borderRadius: 'var(--r-btn)',
            boxShadow: 'var(--sh-tile)',
          }}
          className="mt-5 inline-flex items-center gap-1.5 font-geist font-semibold text-sm px-4 py-2"
        >
          <Plus size={14} />
          Start the buzz
        </button>
      )}
    </div>
  )
}
