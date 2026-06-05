'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { transferClubOwnershipAction } from '@/lib/actions/book-clubs.actions'

type Props = {
  clubId: string
  newOwnerUsername: string | null
  newOwnerId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TransferOwnershipDialog({
  clubId,
  newOwnerUsername,
  newOwnerId,
  open,
  onOpenChange,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleConfirm() {
    startTransition(async () => {
      const result = await transferClubOwnershipAction({
        clubId,
        targetUserId: newOwnerId,
      })
      if (result.success) {
        toast.success(
          newOwnerUsername
            ? `Ownership transferred to @${newOwnerUsername}.`
            : 'Ownership transferred.',
        )
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error('Could not transfer ownership')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'var(--font-comfortaa)' }}>
            Transfer ownership
          </DialogTitle>
          <DialogDescription>
            Make{' '}
            <span className="text-[var(--canvas-dark-ink-strong)]">
              @{newOwnerUsername ?? 'this member'}
            </span>{' '}
            the new owner of this club. You will become a MODERATOR. This cannot
            be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {isPending ? 'Transferring…' : 'Transfer ownership'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
