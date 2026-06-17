'use client'

import { useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen, MoreHorizontal, Star, Trash2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import type { ClubBookRow as ClubBookRowType } from '@/lib/actions/book-clubs.actions'
import {
  removeClubBookAction,
  setCurrentBookAction,
  updateClubBookAction,
} from '@/lib/actions/book-clubs.actions'

type Props = {
  book: ClubBookRowType
  canManage: boolean
  locale: string
  /** Slot for an externally-rendered drag handle (queue rows only). */
  handleSlot?: ReactNode
}

const STATUS_LABEL: Record<ClubBookRowType['status'], string> = {
  CURRENT: 'Reading now',
  QUEUE: 'In queue',
  PAST: 'Past read',
}

/**
 * B7 chrome refresh: row uses A2's `.book-row` grid
 * (`18px 64px 1fr auto`) with an explicit drag-handle column.
 * `handleSlot` is rendered by <ClubBooksPanelClient> for queue rows;
 * CURRENT + PAST rows render an empty first cell to keep alignment.
 */
export function ClubBookRow({ book, canManage, locale, handleSlot }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(book.title)
  const [editAuthor, setEditAuthor] = useState(book.author)
  const [editCoverUrl, setEditCoverUrl] = useState(book.coverUrl ?? '')

  const isCurrent = book.status === 'CURRENT'
  const isQueue = book.status === 'QUEUE'

  const handleSetCurrent = () => {
    startTransition(async () => {
      const result = await setCurrentBookAction({ rowId: book.id })
      if (result.success) {
        toast.success(`${book.title} is now the current book`)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  const handleRemove = () => {
    startTransition(async () => {
      const result = await removeClubBookAction({ rowId: book.id })
      if (result.success) {
        toast.success(`Removed ${book.title}`)
        router.refresh()
      } else if (result.error === 'CANNOT_REMOVE_CURRENT') {
        toast.error('Pick a different current book before removing this one')
      } else {
        toast.error(result.error)
      }
    })
  }

  const handleSaveEdit = () => {
    const title = editTitle.trim()
    const author = editAuthor.trim()
    if (!title || !author) {
      toast.error('Title and author are required')
      return
    }
    const coverUrl = editCoverUrl.trim()
    startTransition(async () => {
      const result = await updateClubBookAction({
        rowId: book.id,
        title,
        author,
        coverUrl: coverUrl ? coverUrl : null,
      })
      if (result.success) {
        toast.success('Saved')
        setEditing(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  const thumb = book.coverUrl ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={book.coverUrl}
      alt=""
      className="br-thumb object-cover"
      style={{ width: 64, height: 96 }}
    />
  ) : (
    <span
      className="br-thumb cover-paper flex items-center justify-center"
      aria-hidden
    >
      <BookOpen
        className="h-6 w-6"
        style={{ color: 'var(--canvas-dark-ink-muted)' }}
        aria-hidden
      />
    </span>
  )

  const statusPill = (
    <span
      className={`pill ${isCurrent ? 'first-draft' : ''}`}
      style={
        isCurrent
          ? undefined
          : {
              background: 'var(--canvas-dark-100)',
              color: 'var(--canvas-dark-ink-muted)',
              borderColor: 'transparent',
            }
      }
    >
      {isCurrent ? <span className="dot" /> : null}
      {STATUS_LABEL[book.status]}
    </span>
  )

  const kebab =
    canManage && !editing ? (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Book actions"
          className="kebab shrink-0"
        >
          <MoreHorizontal aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isQueue && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                handleSetCurrent()
              }}
              disabled={isPending}
            >
              <Star className="h-4 w-4" aria-hidden />
              Set as current
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              setEditing(true)
            }}
            disabled={isPending}
          >
            <Pencil className="h-4 w-4" aria-hidden />
            Edit
          </DropdownMenuItem>
          {!isCurrent && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                handleRemove()
              }}
              disabled={isPending}
              variant="destructive"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Remove
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null

  const rowBody = (
    <div className="book-row">
      {/* Col 1: drag handle (queue) or spacer */}
      <div className="br-handle">{handleSlot ?? null}</div>
      {/* Col 2: thumbnail */}
      {thumb}
      {/* Col 3: title + author + status pill */}
      <div className="min-w-0">
        <h3 className="br-title truncate">{book.title}</h3>
        <p className="br-author truncate">{book.author}</p>
        <div style={{ marginTop: 8 }}>{statusPill}</div>
      </div>
      {/* Col 4: kebab */}
      <div className="self-start">{kebab}</div>
    </div>
  )

  if (editing) {
    return (
      <div
        className="tile tile-pad"
        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Title *</span>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            maxLength={200}
            className="px-3 py-2 rounded-[var(--r-row)] outline-none"
            style={{
              background: 'var(--canvas-dark-200)',
              color: 'var(--canvas-dark-ink)',
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Author *</span>
          <input
            type="text"
            value={editAuthor}
            onChange={(e) => setEditAuthor(e.target.value)}
            maxLength={200}
            className="px-3 py-2 rounded-[var(--r-row)] outline-none"
            style={{
              background: 'var(--canvas-dark-200)',
              color: 'var(--canvas-dark-ink)',
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Cover URL (optional)</span>
          <input
            type="url"
            value={editCoverUrl}
            onChange={(e) => setEditCoverUrl(e.target.value)}
            maxLength={500}
            className="px-3 py-2 rounded-[var(--r-row)] outline-none"
            style={{
              background: 'var(--canvas-dark-200)',
              color: 'var(--canvas-dark-ink)',
            }}
          />
        </label>
        <div className="flex justify-end gap-2 mt-1">
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={isPending}
            className="px-3 py-1.5 rounded-[var(--r-pill)] text-sm font-medium"
            style={{
              background: 'var(--canvas-dark-200)',
              color: 'var(--canvas-dark-ink)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveEdit}
            disabled={isPending}
            className="px-3 py-1.5 rounded-[var(--r-pill)] text-sm font-semibold disabled:opacity-60"
            style={{
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
            }}
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  if (book.bookId) {
    return (
      <Link
        href={`/${locale}/books/${book.bookId}`}
        className="tile tile-pad block transition-colors hover:opacity-95"
      >
        {rowBody}
      </Link>
    )
  }

  return <div className="tile tile-pad">{rowBody}</div>
}
