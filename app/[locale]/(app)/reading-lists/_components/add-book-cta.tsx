'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { AddBookModal } from './add-book-modal'

type Props = { listId: string }

export function AddBookCTA({ listId }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[var(--r-pill)] text-sm font-semibold mt-4 mb-2"
        style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
      >
        <Plus className="h-4 w-4" />
        Add book
      </button>
      <AddBookModal listId={listId} open={open} onOpenChange={setOpen} />
    </>
  )
}
