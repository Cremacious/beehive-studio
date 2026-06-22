'use client'

import { useState } from 'react'
import { DiscussionComposer } from '../../../_components/discussion-composer'

export function NewDiscussionButton({ clubId }: { clubId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: 'var(--brand)',
          color: 'var(--brand-ink)',
          border: 'none',
          borderRadius: 999,
          padding: '8px 16px',
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        + New discussion
      </button>
      <DiscussionComposer clubId={clubId} open={open} onOpenChange={setOpen} />
    </>
  )
}
