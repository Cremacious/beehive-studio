'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { changeClubMemberRoleAction } from '@/lib/actions/book-clubs.actions'

type Role = 'MODERATOR' | 'MEMBER'

type Props = {
  clubId: string
  memberId: string // target userId
  memberUsername: string | null
  currentRole: Role
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RoleChangeDialog({
  clubId,
  memberId,
  memberUsername,
  currentRole,
  open,
  onOpenChange,
}: Props) {
  const [role, setRole] = useState<Role>(currentRole)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    if (open) setRole(currentRole)
  }, [open, currentRole])

  function handleSubmit() {
    startTransition(async () => {
      const result = await changeClubMemberRoleAction({
        clubId,
        targetUserId: memberId,
        newRole: role,
      })
      if (result.success) {
        toast.success(
          memberUsername
            ? `@${memberUsername} is now ${role.toLowerCase()}.`
            : 'Role updated.',
        )
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error('Could not update role')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'var(--font-comfortaa)' }}>
            Change role
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-[var(--canvas-dark-ink-muted)]">
            Pick a new role for{' '}
            <span className="text-[var(--canvas-dark-ink-strong)]">
              @{memberUsername ?? 'this member'}
            </span>
            .
          </p>
          <fieldset className="space-y-2">
            <label className="flex items-start gap-2 cursor-pointer p-3 rounded-[var(--r-row)] border border-[var(--br-card)] hover:border-[var(--canvas-dark-ink-muted)]">
              <input
                type="radio"
                name="role"
                value="MODERATOR"
                checked={role === 'MODERATOR'}
                onChange={() => setRole('MODERATOR')}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-semibold text-[var(--canvas-dark-ink-strong)]">
                  Moderator
                </span>
                <span className="block text-xs text-[var(--canvas-dark-ink-muted)]">
                  Can invite, manage books, pin discussions.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer p-3 rounded-[var(--r-row)] border border-[var(--br-card)] hover:border-[var(--canvas-dark-ink-muted)]">
              <input
                type="radio"
                name="role"
                value="MEMBER"
                checked={role === 'MEMBER'}
                onChange={() => setRole('MEMBER')}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-semibold text-[var(--canvas-dark-ink-strong)]">
                  Member
                </span>
                <span className="block text-xs text-[var(--canvas-dark-ink-muted)]">
                  Can post discussions, view all club content.
                </span>
              </span>
            </label>
          </fieldset>
        </div>
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
            onClick={handleSubmit}
            disabled={isPending || role === currentRole}
            className="bg-brand text-brand-ink hover:bg-brand-hover"
          >
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
