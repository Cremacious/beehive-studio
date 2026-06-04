'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { ComposeBuzzModal } from './compose-buzz-modal'

export function BuzzHeaderCTA({ hiveId }: { hiveId: string }) {
  const [open, setOpen] = useState(false)
  return (
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
        className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold transition-transform hover:-translate-y-px hover:bg-[var(--brand-hover)] active:translate-y-0 active:bg-[var(--brand-active)]"
      >
        <Plus size={15} strokeWidth={2.4} />
        New Buzz
      </button>
      <ComposeBuzzModal open={open} onOpenChange={setOpen} hiveId={hiveId} />
    </>
  )
}
