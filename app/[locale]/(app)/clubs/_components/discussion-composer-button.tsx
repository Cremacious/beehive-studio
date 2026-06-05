'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { DiscussionComposer } from './discussion-composer'

type Props = {
  clubId: string
}

export function DiscussionComposerButton({ clubId }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-pill)] text-sm font-semibold transition"
        style={{
          background: 'var(--brand)',
          color: 'var(--brand-ink)',
        }}
      >
        <Plus className="h-4 w-4" /> New Discussion
      </button>
      <DiscussionComposer clubId={clubId} open={open} onOpenChange={setOpen} />
    </>
  )
}
