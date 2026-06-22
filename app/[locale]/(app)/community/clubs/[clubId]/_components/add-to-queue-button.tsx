'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { AddBookToClubModal } from '../../_components/add-book-to-club-modal'

export function AddToQueueButton({ clubId }: { clubId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          marginTop: 4,
          padding: '5px 10px',
          background: 'transparent',
          border: '1px dashed rgba(255,195,0,0.30)',
          borderRadius: 'var(--r-btn)',
          color: 'var(--brand)',
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          flexShrink: 0,
          alignSelf: 'flex-start',
        }}
      >
        <Plus aria-hidden="true" style={{ width: 11, height: 11 }} />
        Add another
      </button>
      <AddBookToClubModal
        clubId={clubId}
        open={open}
        onOpenChange={setOpen}
        defaultTarget="QUEUE"
      />
    </>
  )
}
