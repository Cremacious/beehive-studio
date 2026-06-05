'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { AddScheduleItemModal } from './add-schedule-item-modal'
import { removeScheduleItemAction } from '@/lib/actions/book-clubs.actions'
import type { ClubScheduleItem } from '@/lib/actions/book-clubs.actions'
import type { BookClubMemberRole } from '@/db/schema/social'

type Props = {
  item: ClubScheduleItem
  clubId: string
  currentBookId: string | null
  currentBookTitle: string | null
  viewerRole: BookClubMemberRole | null
}

type Bucket = 'past' | 'today' | 'future'

const bucketFor = (target: Date): Bucket => {
  const now = new Date()
  const todayY = now.getFullYear()
  const todayM = now.getMonth()
  const todayD = now.getDate()
  const t = new Date(target)
  const ty = t.getFullYear()
  const tm = t.getMonth()
  const td = t.getDate()
  if (ty === todayY && tm === todayM && td === todayD) return 'today'
  if (t.getTime() < new Date(todayY, todayM, todayD).getTime()) return 'past'
  return 'future'
}

const formatDate = (d: Date): string =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export function ScheduleItemRow({
  item,
  clubId,
  currentBookId,
  currentBookTitle,
  viewerRole,
}: Props) {
  const isModPlus = viewerRole === 'OWNER' || viewerRole === 'MODERATOR'
  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const bucket = bucketFor(item.targetDate)
  const borderColor =
    bucket === 'today'
      ? 'var(--brand)'
      : bucket === 'past'
        ? 'var(--canvas-dark-300)'
        : 'var(--br-card)'
  const dateColor =
    bucket === 'today'
      ? 'var(--brand)'
      : bucket === 'past'
        ? 'var(--canvas-dark-ink-muted)'
        : 'var(--canvas-dark-ink)'

  const chapterText =
    item.chapterStart === item.chapterEnd
      ? `Chapter ${item.chapterStart}`
      : `Chapters ${item.chapterStart}–${item.chapterEnd}`

  const handleRemove = () => {
    startTransition(async () => {
      const result = await removeScheduleItemAction({ itemId: item.id })
      if (result.success) {
        toast.success('Milestone removed')
        router.refresh()
      } else {
        toast.error(`Could not remove milestone (${result.error})`)
      }
    })
  }

  return (
    <>
      <li
        className="flex items-center gap-4 px-4 py-3 rounded-[var(--r-row)] border-l-2"
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          borderLeftColor: borderColor,
          boxShadow: 'var(--sh-tile)',
          opacity: bucket === 'past' ? 0.7 : 1,
        }}
      >
        <div
          className="shrink-0 px-3 py-1.5 rounded-[var(--r-pill)] text-xs font-mono font-semibold uppercase tracking-wider"
          style={{
            background: 'var(--canvas-dark-100)',
            color: dateColor,
            boxShadow: 'var(--sh-inset)',
          }}
        >
          {formatDate(item.targetDate)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--canvas-dark-ink)]">
            {chapterText}
          </div>
          {item.label && (
            <div className="text-xs italic text-[var(--canvas-dark-ink-muted)] mt-0.5 truncate">
              {item.label}
            </div>
          )}
        </div>
        {isModPlus && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="shrink-0 p-1.5 rounded-md text-[var(--canvas-dark-ink-muted)] hover:text-[var(--canvas-dark-ink)] hover:bg-[var(--canvas-dark-300)]"
                aria-label="Milestone actions"
              >
                <MoreHorizontal size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil size={14} className="mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  setConfirmOpen(true)
                }}
                disabled={isPending}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 size={14} className="mr-2" /> Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </li>
      {isModPlus && (currentBookId ?? item.bookId) && (
        <AddScheduleItemModal
          clubId={clubId}
          currentBookId={currentBookId ?? item.bookId}
          currentBookTitle={currentBookTitle ?? 'Current book'}
          open={editOpen}
          onOpenChange={setEditOpen}
          initialItem={{
            id: item.id,
            bookId: item.bookId,
            chapterStart: item.chapterStart,
            chapterEnd: item.chapterEnd,
            targetDate: item.targetDate,
            label: item.label,
          }}
        />
      )}
      {isModPlus && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Remove milestone?"
          description="This milestone will be removed from the schedule. This cannot be undone."
          confirmLabel="Remove"
          variant="destructive"
          onConfirm={handleRemove}
        />
      )}
    </>
  )
}
