'use client'
import { Plus } from 'lucide-react'

type Props = { listId: string }

/**
 * T10 stub. T12 will replace this with a trigger that opens <AddBookModal>
 * (2-tab Beehive search + external add).
 */
export function AddBookCTA({ listId }: Props) {
  void listId
  return (
    <button
      type="button"
      disabled
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[var(--r-pill)] text-sm font-semibold mt-4 mb-2 opacity-60 cursor-not-allowed"
      style={{
        background: 'var(--brand)',
        color: 'var(--brand-ink)',
      }}
      title="Coming soon (T12)"
    >
      <Plus className="h-4 w-4" />
      Add book
    </button>
  )
}
