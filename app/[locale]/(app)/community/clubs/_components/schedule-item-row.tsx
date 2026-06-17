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
  isLast?: boolean
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

const monthAbbr = (d: Date): string =>
  new Date(d).toLocaleDateString('en-US', { month: 'short' })

const dayNum = (d: Date): string => {
  const day = new Date(d).getDate()
  return day < 10 ? `0${day}` : `${day}`
}

export function ScheduleItemRow({
  item,
  clubId,
  currentBookId,
  currentBookTitle,
  viewerRole,
  isLast = false,
}: Props) {
  const isModPlus = viewerRole === 'OWNER' || viewerRole === 'MODERATOR'
  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const bucket = bucketFor(item.targetDate)

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

  // Date pill styling per bucket
  const datePillStyle: React.CSSProperties = {
    background:
      bucket === 'today' ? 'var(--brand-soft)' : 'var(--canvas-dark-100)',
    boxShadow:
      bucket === 'today'
        ? 'inset 0 0 0 1px oklch(from var(--brand) l c h / 0.4)'
        : 'var(--sh-inset)',
    opacity: bucket === 'past' ? 0.5 : 1,
  }

  const dateInkColor =
    bucket === 'today' ? 'var(--brand)' : 'var(--canvas-dark-ink-strong)'
  const dateMonoColor =
    bucket === 'today' ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)'

  return (
    <>
      <li
        className="grid items-center gap-[18px] py-4"
        style={{
          gridTemplateColumns: '88px 1fr 40px',
          borderBottom: isLast
            ? 'none'
            : '1px solid oklch(from var(--canvas-dark-300) l c h / 0.5)',
        }}
      >
        <span
          className="inline-flex flex-col items-center py-[9px] rounded-[var(--r-row)]"
          style={datePillStyle}
        >
          <span
            className="font-mono uppercase"
            style={{
              fontSize: '10px',
              letterSpacing: '0.1em',
              color: dateMonoColor,
            }}
          >
            {monthAbbr(item.targetDate)}
          </span>
          <span
            className="font-comfortaa font-bold"
            style={{
              fontSize: '20px',
              color: dateInkColor,
            }}
          >
            {dayNum(item.targetDate)}
          </span>
        </span>
        <div className="min-w-0">
          <div className="font-comfortaa font-bold text-[15px] text-[var(--canvas-dark-ink-strong)] flex items-center gap-2 flex-wrap">
            <span>{chapterText}</span>
            {bucket === 'today' && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--r-pill)] font-mono uppercase"
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.06em',
                  background: 'var(--brand-soft)',
                  color: 'var(--brand)',
                  boxShadow:
                    'inset 0 0 0 1px oklch(from var(--brand) l c h / 0.3)',
                }}
              >
                <span
                  className="inline-block rounded-full"
                  style={{
                    width: 5,
                    height: 5,
                    background: 'var(--brand)',
                  }}
                />
                This week
              </span>
            )}
          </div>
          {item.label && (
            <div className="text-[13px] text-[var(--canvas-dark-ink-muted)] mt-[3px] truncate">
              {item.label}
            </div>
          )}
        </div>
        {isModPlus ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="justify-self-end shrink-0 p-1.5 rounded-md text-[var(--canvas-dark-ink-muted)] hover:text-[var(--canvas-dark-ink)] hover:bg-[var(--canvas-dark-300)]"
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
        ) : (
          <span />
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
