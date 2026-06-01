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
    <div className="px-6 py-12 rounded-md border border-dashed border-border text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mb-3">
        <Sparkles size={20} className="text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold text-foreground">No posts yet</p>
      <p className="text-xs text-muted-foreground mt-1">
        Drop your first vibe — an inspiration, a link, or just a thought.
      </p>
      {canPost && (
        <button
          type="button"
          onClick={onCompose}
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold"
          style={{
            background: 'var(--color-brand)',
            color: 'var(--brand-ink, oklch(0.18 0.02 60))',
          }}
        >
          <Plus size={14} />
          New Post
        </button>
      )}
    </div>
  )
}
