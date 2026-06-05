'use client'

import { useState, useTransition } from 'react'
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
}

const STATUS_LABEL: Record<ClubBookRowType['status'], string> = {
  CURRENT: 'Reading now',
  QUEUE: 'In queue',
  PAST: 'Past read',
}

export function ClubBookRow({ book, canManage, locale }: Props) {
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

  const rowInner = (
    <div
      className="flex items-stretch gap-4 p-3 rounded-[var(--r-row)]"
      style={{ background: 'var(--canvas-dark-100)' }}
    >
      {/* Thumb */}
      <div className="shrink-0 w-[64px] h-[96px] sm:w-[96px] sm:h-[144px] rounded-md overflow-hidden">
        {book.coverUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={book.coverUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background:
                'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
              boxShadow: 'var(--sh-tile)',
            }}
          >
            <BookOpen
              className="h-8 w-8"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
              aria-hidden
            />
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-comfortaa font-bold text-lg leading-tight truncate">
              {book.title}
            </h3>
            <p
              className="text-sm truncate mt-0.5"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              {book.author}
            </p>
          </div>

          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Book actions"
                className="shrink-0 p-1 rounded-md hover:bg-[var(--canvas-dark-200)]"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
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
          )}
        </div>

        <div className="flex items-center gap-2 mt-1">
          <span
            className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-[var(--r-pill)]"
            style={{
              background: isCurrent
                ? 'oklch(from var(--brand) l c h / 0.18)'
                : 'var(--canvas-dark-200)',
              color: isCurrent
                ? 'var(--brand)'
                : 'var(--canvas-dark-ink-muted)',
            }}
          >
            {STATUS_LABEL[book.status]}
          </span>
        </div>
      </div>
    </div>
  )

  if (editing) {
    return (
      <div
        className="p-3 rounded-[var(--r-row)] flex flex-col gap-2"
        style={{
          background: 'var(--canvas-dark-100)',
          boxShadow: 'var(--sh-inset)',
        }}
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
        className="block transition-colors hover:opacity-95"
      >
        {rowInner}
      </Link>
    )
  }

  return rowInner
}
