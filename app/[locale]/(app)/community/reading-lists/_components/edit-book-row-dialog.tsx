'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { updateListBookAction } from '@/lib/actions/reading-lists.actions'
import { MetadataBlock } from './add-book-modal'

type Props = {
  bookRowId: string
  initialIsRead: boolean
  initialRating: number | null
  initialCommentary: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditBookRowDialog({
  bookRowId,
  initialIsRead,
  initialRating,
  initialCommentary,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter()
  const [rating, setRating] = useState<number | null>(initialRating)
  const [commentary, setCommentary] = useState(initialCommentary ?? '')
  const [isRead, setIsRead] = useState(initialIsRead)
  const [isPending, startTransition] = useTransition()

  // Re-sync when opened with possibly-new initials.
  useEffect(() => {
    if (open) {
      setRating(initialRating)
      setCommentary(initialCommentary ?? '')
      setIsRead(initialIsRead)
    }
  }, [open, initialIsRead, initialRating, initialCommentary])

  const handleSubmit = () => {
    const trimmed = commentary.trim()
    startTransition(async () => {
      const result = await updateListBookAction({
        bookRowId,
        isRead,
        rating,
        commentary: trimmed.length > 0 ? trimmed : null,
      })
      if (result.success) {
        toast.success('Updated')
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit book</DialogTitle>
        </DialogHeader>

        <MetadataBlock
          rating={rating}
          onRatingChange={setRating}
          commentary={commentary}
          onCommentaryChange={setCommentary}
          isRead={isRead}
          onIsReadChange={setIsRead}
        />

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="px-4 py-2 rounded-[var(--r-pill)] text-sm font-medium"
            style={{
              background: 'var(--canvas-dark-100)',
              color: 'var(--canvas-dark-ink)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="px-4 py-2 rounded-[var(--r-pill)] text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
            }}
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
