'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  BookOpen,
  Trash2,
  MoreVertical,
  Plus,
  CheckCircle2,
  Pencil,
} from 'lucide-react'
import {
  reorderClubQueueAction,
  setCurrentBookAction,
  removeClubBookAction,
  updateClubBookAction,
  type ClubBookRow as ClubBookRowType,
} from '@/lib/actions/book-clubs.actions'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AddBookToClubModal } from '../../../_components/add-book-to-club-modal'

const PAGE_SIZE = 10

function fmt(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function QueueManager({
  clubId,
  canManage,
  initialCurrent,
  initialQueue,
  initialPast,
}: {
  clubId: string
  canManage: boolean
  initialCurrent: ClubBookRowType | null
  initialQueue: ClubBookRowType[]
  initialPast: ClubBookRowType[]
}) {
  const router = useRouter()
  const [current] = useState(initialCurrent)
  const [queue, setQueue] = useState(initialQueue)
  const [past] = useState(initialPast)
  const [addOpen, setAddOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  useEffect(() => {
    setQueue(initialQueue)
  }, [initialQueue])

  const pageCount = Math.max(1, Math.ceil(queue.length / PAGE_SIZE))
  const pageStart = (page - 1) * PAGE_SIZE
  const pageItems = queue.slice(pageStart, pageStart + PAGE_SIZE)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = queue.findIndex((b) => b.id === active.id)
    const newIndex = queue.findIndex((b) => b.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const prev = queue
    const next = arrayMove(queue, oldIndex, newIndex)
    setQueue(next)
    startTransition(async () => {
      const result = await reorderClubQueueAction({
        clubId,
        orderedIds: next.map((b) => b.id),
      })
      if (!result.success) {
        setQueue(prev)
        toast.error('Could not reorder')
      }
    })
  }

  return (
    <div
      style={{
        background: 'var(--canvas-dark-200)',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 'calc(100vh - 260px)',
      }}
    >
      {/* Currently reading — flat dark block (NO gradient) */}
      <CurrentBlock current={current} />

      {/* Up next section */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          margin: '22px 0 12px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.09em',
            color: 'var(--canvas-dark-ink-muted)',
            fontWeight: 700,
          }}
        >
          Up next
        </span>
        {queue.length > 0 && (
          <span
            style={{
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 999,
              padding: '1px 8px',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--canvas-dark-ink)',
              fontWeight: 700,
            }}
          >
            {queue.length} {queue.length === 1 ? 'book' : 'books'}
          </span>
        )}
        <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
        {canManage && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            style={{
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
              border: 'none',
              borderRadius: 999,
              padding: '5px 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Plus size={11} /> Add book
          </button>
        )}
      </div>

      {/* Queue body */}
      {queue.length === 0 ? (
        <EmptyQueue canManage={canManage} onAdd={() => setAddOpen(true)} />
      ) : canManage ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={pageItems.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pageItems.map((book, idx) => (
                <SortableQueueRow
                  key={book.id}
                  book={book}
                  position={pageStart + idx + 1}
                  hasCurrent={current !== null}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {pageItems.map((book, idx) => (
            <ReadOnlyQueueRow
              key={book.id}
              book={book}
              position={pageStart + idx + 1}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <Pagination page={page} pageCount={pageCount} onChange={setPage} />
      )}

      {/* Flex spacer ensures the panel always fills the viewport even when sparse */}
      <div style={{ flex: 1, minHeight: 24 }} />

      {/* Past reads accordion */}
      <PastReadsAccordion past={past} />

      {addOpen && (
        <AddBookToClubModal
          clubId={clubId}
          open={addOpen}
          onOpenChange={(v: boolean) => {
            setAddOpen(v)
            if (!v) router.refresh()
          }}
          defaultTarget="QUEUE"
        />
      )}
    </div>
  )
}

/* ─── Current block ─── */

function CurrentBlock({ current }: { current: ClubBookRowType | null }) {
  if (!current) {
    return (
      <div
        style={{
          padding: '20px 18px',
          background: 'var(--canvas-dark-100)',
          borderRadius: 'var(--r-row)',
          boxShadow: 'var(--sh-inset)',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 15,
            color: 'var(--canvas-dark-ink-strong)',
          }}
        >
          No current book
        </p>
        <p
          style={{
            margin: '4px 0 0',
            fontSize: 12,
            color: 'var(--canvas-dark-ink-muted)',
          }}
        >
          Pick a queued book and click &ldquo;Make current&rdquo; to start reading.
        </p>
      </div>
    )
  }
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        padding: '16px 18px',
        background: 'var(--canvas-dark-100)',
        borderRadius: 'var(--r-row)',
        boxShadow: 'var(--sh-inset)',
      }}
    >
      {current.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={current.coverUrl}
          alt=""
          style={{
            width: 70,
            height: 100,
            borderRadius: 5,
            objectFit: 'cover',
            flexShrink: 0,
            boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
          }}
        />
      ) : (
        <div
          style={{
            width: 70,
            height: 100,
            borderRadius: 5,
            background: 'var(--canvas-dark-400)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BookOpen
            aria-hidden="true"
            style={{ width: 24, height: 24, color: 'var(--canvas-dark-ink-muted)' }}
          />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            margin: '0 0 4px',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: '0.09em',
            color: 'var(--brand)',
            fontWeight: 700,
          }}
        >
          <BookOpen aria-hidden="true" style={{ width: 10, height: 10 }} />
          Currently reading
        </p>
        <p
          style={{
            margin: '0 0 3px',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 17,
            color: 'var(--canvas-dark-ink-strong)',
          }}
        >
          {current.title}
        </p>
        <p
          style={{
            margin: '0 0 10px',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            color: 'var(--canvas-dark-ink-muted)',
          }}
        >
          {current.author}
        </p>
        <div
          style={{
            display: 'flex',
            gap: 14,
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--canvas-dark-ink-muted)',
            flexWrap: 'wrap',
          }}
        >
          {current.startedAt && (
            <span>
              Started <span style={{ color: 'var(--canvas-dark-ink)' }}>{fmt(current.startedAt)}</span>
            </span>
          )}
          <span>
            Added <span style={{ color: 'var(--canvas-dark-ink)' }}>{fmt(current.addedAt)}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

/* ─── Empty queue ─── */

function EmptyQueue({
  canManage,
  onAdd,
}: {
  canManage: boolean
  onAdd: () => void
}) {
  return (
    <div
      style={{
        padding: '28px 18px',
        background: 'var(--canvas-dark-100)',
        borderRadius: 'var(--r-row)',
        boxShadow: 'var(--sh-inset)',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 14,
          color: 'var(--canvas-dark-ink-strong)',
        }}
      >
        No books queued yet
      </p>
      <p
        style={{
          margin: '4px 0 14px',
          fontSize: 12,
          color: 'var(--canvas-dark-ink-muted)',
        }}
      >
        {canManage
          ? 'Add books to build the reading queue.'
          : 'A mod will add books when ready.'}
      </p>
      {canManage && (
        <button
          type="button"
          onClick={onAdd}
          style={{
            background: 'var(--brand)',
            color: 'var(--brand-ink)',
            border: 'none',
            borderRadius: 999,
            padding: '7px 16px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <Plus size={12} /> Add first book
        </button>
      )}
    </div>
  )
}

/* ─── Sortable + read-only rows ─── */

function SortableQueueRow({
  book,
  position,
  hasCurrent,
}: {
  book: ClubBookRowType
  position: number
  hasCurrent: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: book.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }
  return (
    <div ref={setNodeRef} style={style}>
      <QueueRow
        book={book}
        position={position}
        canManage
        hasCurrent={hasCurrent}
        dragHandle={
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'grab',
              padding: 2,
              color: 'var(--canvas-dark-ink-muted)',
              touchAction: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <GripVertical size={14} />
          </button>
        }
      />
    </div>
  )
}

function ReadOnlyQueueRow({
  book,
  position,
}: {
  book: ClubBookRowType
  position: number
}) {
  return <QueueRow book={book} position={position} canManage={false} hasCurrent={false} />
}

function QueueRow({
  book,
  position,
  canManage,
  hasCurrent,
  dragHandle,
}: {
  book: ClubBookRowType
  position: number
  canManage: boolean
  hasCurrent: boolean
  dragHandle?: React.ReactNode
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirmDel, setConfirmDel] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  function makeCurrent() {
    startTransition(async () => {
      const result = await setCurrentBookAction({ rowId: book.id })
      if (!result.success) {
        toast.error('Could not promote book')
        return
      }
      toast.success(`${book.title} is now the current book`)
      router.refresh()
    })
  }

  async function doRemove() {
    const result = await removeClubBookAction({ rowId: book.id })
    if (!result.success) {
      toast.error('Could not remove')
      return
    }
    toast.success('Removed from queue')
    router.refresh()
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        background: 'var(--canvas-dark-300)',
        borderRadius: 'var(--r-row)',
        boxShadow: 'var(--sh-tile)',
      }}
    >
      {dragHandle}
      <span
        style={{
          flexShrink: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: 'var(--brand)',
          fontWeight: 700,
          minWidth: 22,
          textAlign: 'right',
        }}
      >
        {position}.
      </span>
      {book.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={book.coverUrl}
          alt=""
          style={{
            width: 38,
            height: 54,
            borderRadius: 4,
            objectFit: 'cover',
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: 38,
            height: 54,
            borderRadius: 4,
            background: 'var(--canvas-dark-400)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BookOpen
            aria-hidden="true"
            style={{ width: 14, height: 14, color: 'var(--canvas-dark-ink-muted)' }}
          />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: '0 0 1px',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 13,
            color: 'var(--canvas-dark-ink-strong)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {book.title}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--canvas-dark-ink-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {book.author}
        </p>
      </div>
      {canManage && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={makeCurrent}
            disabled={pending}
            style={{
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
              border: 'none',
              borderRadius: 999,
              padding: '4px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              cursor: pending ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
              opacity: pending ? 0.6 : 1,
            }}
            title={hasCurrent ? 'Move current book to Past and start this one' : 'Start reading this book'}
          >
            <CheckCircle2 size={11} />
            Make current
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="More actions"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--canvas-dark-ink-muted)',
                  padding: 4,
                  borderRadius: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                <MoreVertical size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[160px]">
              <DropdownMenuItem
                className="text-[12px] whitespace-nowrap flex items-center gap-1.5"
                onSelect={(e) => {
                  e.preventDefault()
                  setEditOpen(true)
                }}
              >
                <Pencil size={12} className="shrink-0" />
                <span>Edit book</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive text-[12px] whitespace-nowrap flex items-center gap-1.5"
                onSelect={(e) => {
                  e.preventDefault()
                  setConfirmDel(true)
                }}
              >
                <Trash2 size={12} className="shrink-0" />
                <span>Remove from queue</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <EditBookDialog
            book={book}
            open={editOpen}
            onOpenChange={setEditOpen}
            onSaved={() => router.refresh()}
          />
          <ConfirmDialog
            open={confirmDel}
            onOpenChange={setConfirmDel}
            variant="destructive"
            title={`Remove "${book.title}"?`}
            description="The book will be removed from the queue. This cannot be undone."
            confirmLabel="Remove"
            onConfirm={doRemove}
          />
        </div>
      )}
    </div>
  )
}

/* ─── Pagination ─── */

function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number
  pageCount: number
  onChange: (next: number) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        marginTop: 18,
      }}
    >
      <PageBtn
        label="‹"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
      />
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
        <PageBtn key={p} label={String(p)} onClick={() => onChange(p)} active={p === page} />
      ))}
      <PageBtn
        label="›"
        onClick={() => onChange(Math.min(pageCount, page + 1))}
        disabled={page === pageCount}
      />
    </div>
  )
}

function PageBtn({
  label,
  onClick,
  active,
  disabled,
}: {
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 30,
        height: 30,
        borderRadius: 999,
        background: active ? 'var(--brand)' : 'var(--canvas-dark-300)',
        boxShadow: 'var(--sh-tile)',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: active ? 700 : 400,
        color: active ? 'var(--brand-ink)' : 'var(--canvas-dark-ink-muted)',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {label}
    </button>
  )
}

/* ─── Past reads accordion ─── */

function PastReadsAccordion({ past }: { past: ClubBookRowType[] }) {
  if (past.length === 0) {
    return (
      <div
        style={{
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 'var(--r-row)',
          padding: '12px 14px',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--canvas-dark-ink-muted)',
          fontStyle: 'italic',
          textAlign: 'center',
        }}
      >
        No past reads yet
      </div>
    )
  }
  return (
    <details
      style={{
        background: 'rgba(255,255,255,0.02)',
        borderRadius: 'var(--r-row)',
        overflow: 'hidden',
      }}
    >
      <summary
        style={{
          listStyle: 'none',
          cursor: 'pointer',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--canvas-dark-ink-muted)',
          fontWeight: 700,
        }}
      >
        <span>📚 Past reads &middot; {past.length}</span>
        <span>+</span>
      </summary>
      <div style={{ padding: '0 14px 12px' }}>
        {past.map((book) => (
          <div
            key={book.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 0',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              fontSize: 12,
            }}
          >
            {book.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={book.coverUrl}
                alt=""
                style={{
                  width: 22,
                  height: 30,
                  borderRadius: 3,
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 22,
                  height: 30,
                  borderRadius: 3,
                  background: 'var(--canvas-dark-400)',
                  flexShrink: 0,
                }}
              />
            )}
            <span style={{ flex: 1, color: 'var(--canvas-dark-ink)' }}>
              {book.title} &middot;{' '}
              <span style={{ color: 'var(--canvas-dark-ink-muted)' }}>{book.author}</span>
            </span>
            {book.finishedAt && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--canvas-dark-ink-muted)',
                }}
              >
                Finished {fmt(book.finishedAt)}
              </span>
            )}
          </div>
        ))}
      </div>
    </details>
  )
}

/* ─── Edit book dialog ─── */

function EditBookDialog({
  book,
  open,
  onOpenChange,
  onSaved,
}: {
  book: ClubBookRowType
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(book.title)
  const [author, setAuthor] = useState(book.author)
  const [coverUrl, setCoverUrl] = useState(book.coverUrl ?? '')
  const [pending, startSave] = useTransition()

  useEffect(() => {
    if (open) {
      setTitle(book.title)
      setAuthor(book.author)
      setCoverUrl(book.coverUrl ?? '')
    }
  }, [open, book.title, book.author, book.coverUrl])

  const isDirty =
    title.trim() !== book.title.trim() ||
    author.trim() !== book.author.trim() ||
    coverUrl.trim() !== (book.coverUrl ?? '').trim()

  function save() {
    const t = title.trim()
    const a = author.trim()
    if (!t || !a) {
      toast.error('Title and author are required')
      return
    }
    startSave(async () => {
      const result = await updateClubBookAction({
        rowId: book.id,
        title: t,
        author: a,
        coverUrl: coverUrl.trim() || null,
      })
      if (!result.success) {
        toast.error('Could not save')
        return
      }
      toast.success('Book updated')
      onOpenChange(false)
      onSaved()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--brand)' }}>Edit book</DialogTitle>
        </DialogHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label>
            <span style={editLabelStyle}>Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              style={editInputStyle}
            />
          </label>
          <label>
            <span style={editLabelStyle}>Author</span>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              maxLength={120}
              style={editInputStyle}
            />
          </label>
          <label>
            <span style={editLabelStyle}>Cover image URL (optional)</span>
            <input
              type="url"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://…"
              style={editInputStyle}
            />
          </label>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'var(--canvas-dark-ink-muted)',
              borderRadius: 999,
              padding: '7px 14px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending || !isDirty}
            style={{
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
              border: 'none',
              borderRadius: 999,
              padding: '7px 16px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              cursor: pending || !isDirty ? 'not-allowed' : 'pointer',
              opacity: pending || !isDirty ? 0.55 : 1,
            }}
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const editLabelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--canvas-dark-ink-muted)',
  marginBottom: 5,
}

const editInputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--canvas-dark-100)',
  boxShadow: 'var(--sh-inset)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: 'var(--r-row)',
  padding: '9px 12px',
  color: 'var(--canvas-dark-ink-strong)',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
}
