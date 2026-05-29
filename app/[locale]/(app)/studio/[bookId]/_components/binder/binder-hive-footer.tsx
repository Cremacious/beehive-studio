'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { Users, Plus, ChevronRight } from 'lucide-react'
import { CreateHiveModal } from '../../../_components/create-hive-modal'
import { useBookEditor } from '../book-editor-provider'

export function BinderHiveFooter() {
  const { bookId, bookHive } = useBookEditor()
  const { locale } = useParams<{ locale: string }>()
  const [open, setOpen] = useState(false)

  if (bookHive) {
    return (
      <Link
        href={`/${locale}/hive/${bookHive.hiveId}`}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md border border-border bg-transparent text-foreground hover:bg-surface-elevated transition-colors text-[13px]"
        title="Go to Hive"
      >
        <Users size={14} className="text-muted-foreground flex-shrink-0" />
        <span className="flex-1 text-left">Go to Hive</span>
        <ChevronRight size={12} className="text-muted-foreground flex-shrink-0" />
      </Link>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md border border-border bg-transparent text-foreground hover:bg-surface-elevated transition-colors text-[13px]"
        title="Create Hive"
      >
        <Plus size={14} className="text-muted-foreground flex-shrink-0" />
        <span className="flex-1 text-left">Create Hive</span>
        <ChevronRight size={12} className="text-muted-foreground flex-shrink-0" />
      </button>
      <CreateHiveModal open={open} onOpenChange={setOpen} prelockBookId={bookId} />
    </>
  )
}
