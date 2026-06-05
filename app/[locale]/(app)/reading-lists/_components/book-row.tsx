'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Star, BookOpen, MoreHorizontal } from 'lucide-react'
import type { ListBookRow } from '@/lib/actions/reading-lists.actions'
import type { DerivedBookRow } from '@/lib/reading-lists/liked-list-books'
import {
  updateListBookAction,
  removeBookFromListAction,
} from '@/lib/actions/reading-lists.actions'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EditBookRowDialog } from './edit-book-row-dialog'

type Props = {
  book: ListBookRow | DerivedBookRow
  isOwner: boolean
  locale: string
}

/**
 * T13 enriched: 96px thumbnail (cover or gradient placeholder), 5-star
 * rating display (owner click-to-edit), commentary excerpt with Show
 * more/less, owner isRead checkbox with optimistic flip + rollback, ⋯
 * kebab (Edit Metadata / Remove) for CUSTOM-list owners. Liked-derived
 * rows are immutable so kebab + checkbox are hidden on them.
 */
export function BookRow({ book, isOwner, locale }: Props) {
  const router = useRouter()
  const [isRead, setIsRead] = useState(book.isRead)
  const [pendingRead, startReadTransition] = useTransition()
  const [pendingRemove, startRemoveTransition] = useTransition()
  const [expanded, setExpanded] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)

  // Liked-derived rows have synthetic ids starting with "liked-" and are
  // immutable. Detect via rating === null + commentary === null is too loose;
  // use the synthetic-id prefix instead.
  const isDerived = book.id.startsWith('liked-')
  const canEdit = isOwner && !isDerived

  const innerStyle = {
    background:
      'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    boxShadow: 'var(--sh-tile)',
  } as const

  const rating = book.rating ?? 0
  const commentary = book.commentary?.trim() ?? ''
  const hasCommentary = commentary.length > 0
  const commentaryIsLong = commentary.length > 140

  function toggleRead(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!canEdit) return
    const next = !isRead
    setIsRead(next)
    startReadTransition(async () => {
      const result = await updateListBookAction({
        bookRowId: book.id,
        isRead: next,
      })
      if (!result.success) {
        setIsRead(!next)
        toast.error(result.error)
      }
    })
  }

  function handleRemove() {
    startRemoveTransition(async () => {
      const result = await removeBookFromListAction({ bookRowId: book.id })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Removed from list')
      router.refresh()
    })
  }

  const content = (
    <div className="flex gap-3">
      {/* Thumbnail */}
      <div
        className="shrink-0 w-[96px] rounded-[var(--r-row)] overflow-hidden"
        style={{ aspectRatio: '2 / 3' }}
      >
        {book.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
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
                'linear-gradient(135deg, var(--canvas-dark-300), var(--canvas-dark-200))',
            }}
          >
            <BookOpen
              className="h-6 w-6 text-[var(--canvas-dark-ink-muted)]"
              aria-hidden
            />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={toggleRead}
              disabled={pendingRead}
              aria-pressed={isRead}
              aria-label={isRead ? 'Mark unread' : 'Mark read'}
              className="mt-1 h-4 w-4 shrink-0 rounded border flex items-center justify-center disabled:opacity-60"
              style={{
                borderColor: isRead ? 'var(--brand)' : 'var(--br-card)',
                background: isRead ? 'var(--brand)' : 'transparent',
                color: isRead ? 'var(--brand-ink)' : 'transparent',
              }}
            >
              {isRead && (
                <span className="text-[10px] leading-none" aria-hidden>
                  ✓
                </span>
              )}
            </button>
          )}

          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm text-[var(--canvas-dark-ink-strong)] truncate">
              {book.title}
            </h4>
            <p className="text-xs text-[var(--canvas-dark-ink-muted)] truncate">
              by {book.author}
            </p>
          </div>

          {canEdit && (
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="h-6 w-6 inline-flex items-center justify-center rounded-md text-[var(--canvas-dark-ink-muted)] hover:bg-[var(--canvas-dark-300)]"
                    aria-label="Book actions"
                    onClick={(e) => e.preventDefault()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault()
                      setEditOpen(true)
                    }}
                  >
                    Edit metadata
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault()
                      setConfirmRemoveOpen(true)
                    }}
                    className="text-destructive"
                  >
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {!canEdit && isRead && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--brand)] shrink-0">
              Read
            </span>
          )}
        </div>

        {/* Rating */}
        {(rating > 0 || canEdit) && (
          <div
            className="flex items-center gap-0.5 mt-1.5"
            onClick={(e) => {
              if (!canEdit) return
              e.preventDefault()
              e.stopPropagation()
              setEditOpen(true)
            }}
            style={{ cursor: canEdit ? 'pointer' : 'default' }}
            title={canEdit ? 'Edit rating' : undefined}
          >
            {[1, 2, 3, 4, 5].map((n) => {
              const filled = n <= rating
              return (
                <Star
                  key={n}
                  className="h-3.5 w-3.5"
                  style={{
                    fill: filled ? 'var(--brand)' : 'transparent',
                    color: filled
                      ? 'var(--brand)'
                      : 'var(--canvas-dark-ink-muted)',
                  }}
                  aria-hidden
                />
              )
            })}
            {rating > 0 && (
              <span className="ml-1 text-[10px] font-mono text-[var(--canvas-dark-ink-muted)]">
                {rating}/5
              </span>
            )}
          </div>
        )}

        {/* Commentary */}
        {hasCommentary && (
          <div className="mt-2">
            <p
              className={`text-xs text-[var(--canvas-dark-ink)] whitespace-pre-wrap ${
                expanded ? '' : 'line-clamp-2'
              }`}
            >
              {commentary}
            </p>
            {commentaryIsLong && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setExpanded((v) => !v)
                }}
                className="mt-1 text-[10px] font-mono uppercase tracking-wider text-[var(--brand)]"
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )

  const wrapper = book.bookId ? (
    <Link
      href={`/${locale}/books/${book.bookId}`}
      className="block p-3 rounded-[var(--r-row)] border border-[var(--br-card)] hover:border-[var(--canvas-dark-ink-muted)] transition-colors"
      style={innerStyle}
    >
      {content}
    </Link>
  ) : (
    <div
      className="block p-3 rounded-[var(--r-row)] border border-[var(--br-card)]"
      style={innerStyle}
    >
      {content}
    </div>
  )

  return (
    <>
      {wrapper}
      {canEdit && (
        <>
          <EditBookRowDialog
            bookRowId={book.id}
            initialIsRead={isRead}
            initialRating={book.rating}
            initialCommentary={book.commentary}
            open={editOpen}
            onOpenChange={setEditOpen}
          />
          <ConfirmDialog
            open={confirmRemoveOpen}
            onOpenChange={setConfirmRemoveOpen}
            title="Remove book from list?"
            description={`"${book.title}" will be removed from this list.`}
            variant="destructive"
            confirmLabel={pendingRemove ? 'Removing…' : 'Remove'}
            onConfirm={handleRemove}
          />
        </>
      )}
    </>
  )
}
