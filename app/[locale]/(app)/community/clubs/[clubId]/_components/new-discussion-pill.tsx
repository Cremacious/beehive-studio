'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { DiscussionComposer } from '../../_components/discussion-composer'

export function NewDiscussionPill({ clubId }: { clubId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          padding: '3px 9px 3px 7px',
          borderRadius: 999,
          background: 'var(--brand)',
          color: 'var(--brand-ink)',
          border: 'none',
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        <Plus aria-hidden="true" style={{ width: 11, height: 11 }} />
        New
      </button>
      <DiscussionComposer clubId={clubId} open={open} onOpenChange={setOpen} />
    </>
  )
}
