'use client'

import { useState } from 'react'
import { CreateHiveModal } from './create-hive-modal'

type Props = { bookId: string; locale: string }

export function CreateHiveButton({ bookId, locale }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-3 py-1.5 rounded-lg bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 transition-colors"
      >
        🐝 Create Hive
      </button>
      {open && <CreateHiveModal bookId={bookId} locale={locale} onClose={() => setOpen(false)} />}
    </>
  )
}
