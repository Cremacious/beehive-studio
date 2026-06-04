'use client'

import { useState } from 'react'
import { Sparkles, Plus } from 'lucide-react'
import { ComposeBuzzModal } from './compose-buzz-modal'

export function BuzzEmptyState({
  canPost,
  hiveId,
}: {
  canPost: boolean
  hiveId?: string
}) {
  const [open, setOpen] = useState(false)
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
      {canPost && hiveId && (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
              borderRadius: 'var(--r-pill)',
              boxShadow: 'var(--sh-tile)',
            }}
            className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 text-[13px] font-semibold transition-transform hover:-translate-y-px hover:bg-[var(--brand-hover)] active:translate-y-0 active:bg-[var(--brand-active)]"
          >
            <Plus size={15} strokeWidth={2.4} />
            Post the first buzz
          </button>
          <ComposeBuzzModal open={open} onOpenChange={setOpen} hiveId={hiveId} />
        </>
      )}
    </div>
  )
}
