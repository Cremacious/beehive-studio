'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { AddScheduleItemModal } from './add-schedule-item-modal'

type Props = {
  clubId: string
  currentBookId: string
  currentBookTitle: string
}

export function AddScheduleItemCTA({
  clubId,
  currentBookId,
  currentBookTitle,
}: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--r-pill)] text-sm font-semibold"
        style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
      >
        <Plus size={14} /> Add milestone
      </button>
      <AddScheduleItemModal
        clubId={clubId}
        currentBookId={currentBookId}
        currentBookTitle={currentBookTitle}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
