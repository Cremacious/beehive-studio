'use client'

import { useState } from 'react'
import { DiscussionComposeModal } from './discussion-compose-modal'

export function NewDiscussionCTA({ hiveId }: { hiveId: string }) {
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
        className="px-4 py-2 text-[13px] font-semibold"
      >
        + New Discussion
      </button>
      <DiscussionComposeModal open={open} onOpenChange={setOpen} hiveId={hiveId} />
    </>
  )
}
