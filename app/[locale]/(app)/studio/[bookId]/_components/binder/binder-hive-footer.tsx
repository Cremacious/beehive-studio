'use client'

import { useState } from 'react'
import { Users, ChevronRight } from 'lucide-react'
import { CreateHiveModal } from '../create-hive-modal'
import { useBookEditor } from '../book-editor-provider'

export function BinderHiveFooter() {
  const { bookId, locale } = useBookEditor()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md border border-border bg-transparent text-foreground hover:bg-surface-elevated transition-colors text-[13px]"
        title="Share with your Hive"
      >
        <Users size={14} className="text-muted-foreground flex-shrink-0" />
        <span className="flex-1 text-left">Share with your Hive</span>
        <ChevronRight size={12} className="text-muted-foreground flex-shrink-0" />
      </button>
      {open && <CreateHiveModal bookId={bookId} locale={locale} onClose={() => setOpen(false)} />}
    </>
  )
}
