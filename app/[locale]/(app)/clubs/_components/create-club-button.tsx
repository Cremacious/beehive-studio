'use client'
import { Plus } from 'lucide-react'

type Props = { locale: string }

/**
 * T10 stub. T12 will replace this with a modal trigger opening
 * <CreateClubModal>.
 */
export function CreateClubButton({ locale }: Props) {
  void locale
  return (
    <button
      type="button"
      disabled
      className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--r-pill)] text-sm font-semibold opacity-60 cursor-not-allowed"
      style={{
        background: 'var(--brand)',
        color: 'var(--brand-ink)',
      }}
      title="Coming soon (T12)"
    >
      <Plus className="h-4 w-4" />
      New club
    </button>
  )
}
