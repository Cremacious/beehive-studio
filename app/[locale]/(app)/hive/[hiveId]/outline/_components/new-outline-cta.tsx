'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { createHiveOutlineAction } from '@/lib/actions/hive-content.actions'

export function NewOutlineCTA({
  hiveId,
  locale,
}: {
  hiveId: string
  locale: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleClick() {
    if (pending) return
    startTransition(async () => {
      const r = await createHiveOutlineAction(hiveId)
      if (!r.success) {
        toast.error(
          r.error === 'NOT_AUTHORIZED'
            ? 'You do not have permission to create an outline.'
            : 'Could not create outline. Please try again.',
        )
        return
      }
      router.push(`/${locale}/hive/${hiveId}/outline/${r.data.outlineId}`)
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold transition-[background,transform] duration-150 disabled:opacity-60"
      style={{
        background: 'var(--brand)',
        color: 'var(--brand-ink)',
        borderRadius: 'var(--r-pill)',
        boxShadow: 'var(--sh-tile)',
      }}
      onMouseEnter={e => {
        if (pending) return
        const el = e.currentTarget
        el.style.background = 'var(--brand-hover)'
        el.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.background = 'var(--brand)'
        el.style.transform = 'translateY(0)'
      }}
      onMouseDown={e => {
        if (pending) return
        const el = e.currentTarget
        el.style.background = 'var(--brand-active)'
        el.style.transform = 'translateY(0)'
      }}
      onMouseUp={e => {
        if (pending) return
        const el = e.currentTarget
        el.style.background = 'var(--brand-hover)'
        el.style.transform = 'translateY(-1px)'
      }}
    >
      <Plus className="w-4 h-4" />
      {pending ? 'Creating…' : 'New Outline'}
    </button>
  )
}
