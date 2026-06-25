'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { toastActionError, toastNetworkError } from '@/lib/errors/notify'
import { deleteContentAction, type ContentKind } from './actions'

export function DeleteContentButton({
  kind,
  id,
  title,
}: {
  kind: ContentKind
  id: string
  title: string
}) {
  const [pending, startTransition] = useTransition()
  const onDelete = () => {
    if (!window.confirm(`Permanently delete "${title}"? This cannot be undone.`)) return
    startTransition(async () => {
      try {
        const res = await deleteContentAction(kind, id)
        if (!res.ok) {
          toastActionError(res.error)
          return
        }
        toast.success('Deleted')
      } catch {
        toastNetworkError()
      }
    })
  }
  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={pending}
      className="px-3 py-1 text-xs rounded-[var(--r-pill)] disabled:opacity-60"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        boxShadow: 'var(--sh-tile)',
        color: 'oklch(0.72 0.2 25)',
      }}
    >
      {pending ? 'Deleting…' : 'Delete'}
    </button>
  )
}
