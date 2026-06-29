'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { DiscussionComposeModal } from './discussion-compose-modal'

export function NewDiscussionCTA({ hiveId, fullWidth = false }: { hiveId: string; fullWidth?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: 'var(--brand)',
          color: 'var(--brand-ink)',
          borderRadius: 'var(--r-pill)',
          boxShadow: 'var(--sh-tile)',
          transition: 'background .14s, transform .1s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--brand-hover)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--brand)'
          e.currentTarget.style.transform = 'none'
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.background = 'var(--brand-active)'
          e.currentTarget.style.transform = 'none'
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.background = 'var(--brand-hover)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }}
        className={`inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold${fullWidth ? ' w-full justify-center min-h-[42px]' : ''}`}
      >
        <Plus size={15} strokeWidth={2.4} />
        New Discussion
      </button>
      <DiscussionComposeModal open={open} onOpenChange={setOpen} hiveId={hiveId} />
    </>
  )
}
