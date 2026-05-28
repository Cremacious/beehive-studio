'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteBookAction } from '@/lib/actions/book.actions'

type Props = {
  bookId: string
  bookTitle: string
  locale: string
  /** Render prop — caller renders the trigger (menu item, button, etc.) and wires `onTrigger` to open the confirm dialog. */
  children: (onTrigger: () => void) => React.ReactNode
}

export function DeleteBookButton({ bookId, bookTitle, locale, children }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function handleConfirm() {
    const result = await deleteBookAction(bookId, locale)
    if (!result.success) {
      toast.error('Could not delete book')
      return
    }
    toast.success(`Deleted "${bookTitle}"`)
    router.push(`/${locale}/studio`)
    router.refresh()
  }

  return (
    <>
      {children(() => setOpen(true))}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        variant="destructive"
        title={`Delete "${bookTitle}"?`}
        description="This permanently removes the book and all of its chapters, notes, and snapshots. This cannot be undone."
        confirmLabel="Delete book"
        onConfirm={handleConfirm}
      />
    </>
  )
}
