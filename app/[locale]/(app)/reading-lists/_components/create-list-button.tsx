'use client'
import { Plus } from 'lucide-react'

type Props = { locale: string }

/**
 * T9 stub. T11 will replace this with a modal trigger that opens
 * <CreateListModal>. For now, renders as a disabled-looking button.
 */
export function CreateListButton({ locale }: Props) {
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
      title="Coming soon (T11)"
    >
      <Plus className="h-4 w-4" />
      New list
    </button>
  )
}
