'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { toastActionError, toastNetworkError } from '@/lib/errors/notify'
import { setPromoActiveAction, deletePromoCodeAction } from './actions'

interface Row {
  id: string
  code: string
  kind: 'DAYS_30' | 'DAYS_90' | 'DAYS_365' | 'LIFETIME'
  note: string | null
  maxUses: number | null
  usesCount: number
  isActive: boolean
  createdAt: string
}

const KIND_LABEL: Record<Row['kind'], string> = {
  DAYS_30: '30 days',
  DAYS_90: '90 days',
  DAYS_365: '1 year',
  LIFETIME: 'Lifetime',
}

export function CodeRow({ row }: { row: Row }) {
  const [pending, startTransition] = useTransition()

  const toggle = () =>
    startTransition(async () => {
      try {
        const res = await setPromoActiveAction(row.id, !row.isActive)
        if (!res.ok) {
          toastActionError(res.error)
          return
        }
        toast.success(row.isActive ? 'Code disabled' : 'Code enabled')
      } catch {
        toastNetworkError()
      }
    })

  const onDelete = () => {
    if (!window.confirm(`Delete code ${row.code}? Past redemptions stay valid.`)) return
    startTransition(async () => {
      try {
        const res = await deletePromoCodeAction(row.id)
        if (!res.ok) {
          toastActionError(res.error)
          return
        }
        toast.success('Code deleted')
      } catch {
        toastNetworkError()
      }
    })
  }

  const usage =
    row.maxUses == null ? `${row.usesCount} / ∞` : `${row.usesCount} / ${row.maxUses}`

  return (
    <li
      className="grid px-5 py-3 text-sm items-center"
      style={{
        gridTemplateColumns: '1.2fr 0.7fr 0.7fr 0.9fr 1.2fr 0.8fr',
        color: 'var(--canvas-dark-ink)',
      }}
    >
      <span
        className="font-mono"
        style={{ color: 'var(--canvas-dark-ink-strong)' }}
      >
        {row.code}
      </span>
      <span>{KIND_LABEL[row.kind]}</span>
      <span style={{ color: 'var(--canvas-dark-ink-muted)' }}>{usage}</span>
      <span style={{ color: row.isActive ? 'oklch(0.75 0.15 145)' : 'var(--canvas-dark-ink-muted)' }}>
        {row.isActive ? 'Active' : 'Disabled'}
      </span>
      <span className="truncate" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
        {row.note ?? '–'}
      </span>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className="px-3 py-1 text-xs rounded-[var(--r-pill)] disabled:opacity-60"
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            boxShadow: 'var(--sh-tile)',
            color: 'var(--canvas-dark-ink-strong)',
          }}
        >
          {row.isActive ? 'Disable' : 'Enable'}
        </button>
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
          Delete
        </button>
      </div>
    </li>
  )
}
