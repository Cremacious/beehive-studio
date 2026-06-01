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
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-row)',
          boxShadow: 'var(--sh-tile)',
          border: 'var(--br-card)',
          color: 'var(--brand)',
        }}
        className="w-full flex items-center gap-2 px-2.5 py-2 font-semibold transition-colors text-[13px] no-underline hover:brightness-110"
        title="Go to Hive"
      >
        <Users size={14} className="flex-shrink-0" style={{ color: 'var(--brand)' }} />
        <span className="flex-1 text-left">Go to Hive</span>
        <ChevronRight size={12} className="flex-shrink-0" style={{ color: 'var(--brand)' }} />
      </Link>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-row)',
          boxShadow: 'var(--sh-tile)',
          border: 'var(--br-card)',
          color: 'var(--brand)',
        }}
        className="w-full flex items-center gap-2 px-2.5 py-2 font-semibold transition-colors text-[13px] hover:brightness-110"
        title="Create Hive"
      >
        <Plus size={14} className="flex-shrink-0" style={{ color: 'var(--brand)' }} />
        <span className="flex-1 text-left">Create Hive</span>
        <ChevronRight size={12} className="flex-shrink-0" style={{ color: 'var(--brand)' }} />
      </button>
      <CreateHiveModal open={open} onOpenChange={setOpen} prelockBookId={bookId} />
    </>
  )
}
