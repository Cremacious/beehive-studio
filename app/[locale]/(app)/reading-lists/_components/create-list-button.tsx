'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { CreateListModal } from './create-list-modal'

type Props = { locale: string }

export function CreateListButton({ locale }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--r-pill)] text-sm font-semibold"
        style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
      >
        <Plus className="h-4 w-4" />
        New List
      </button>
      <CreateListModal locale={locale} open={open} onOpenChange={setOpen} />
    </>
  )
}
