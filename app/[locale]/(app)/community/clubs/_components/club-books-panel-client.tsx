'use client'

import { useEffect, useState, useTransition } from 'react'
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
import { GripVertical, Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { ClubBookRow as ClubBookRowType } from '@/lib/actions/book-clubs.actions'
import { reorderClubQueueAction } from '@/lib/actions/book-clubs.actions'
import { ClubBookRow } from './club-book-row'
import { AddBookToClubModal } from './add-book-to-club-modal'

type Props = {
  clubId: string
  canManage: boolean
  queue: ClubBookRowType[]
  locale: string
}

/**
 * Owns: Add-book modal state + dnd-kit queue reorder (MOD+ only).
 * B7 chrome refresh: header is `.sec-head`, list is `.cstack` inside
 * `.panel.panel-pad`, drag handle threads through ClubBookRow's
 * explicit 18px drag-handle grid column via the `handleSlot` prop.
 */
export function ClubBooksPanelClient({
  clubId,
  canManage,
  queue,
  locale,
}: Props) {
  const [addOpen, setAddOpen] = useState(false)

  return (
    <section>
      <div className="sec-head">
        <h2>Up next</h2>
        {canManage && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="btn-tile btn-sm"
          >
            <Plus aria-hidden />
            Add book
          </button>
        )}
      </div>

      <section className="panel panel-pad">
        {queue.length === 0 ? (
          <p className="text-[var(--canvas-dark-ink-muted)] italic">
            {canManage
              ? 'No books in the queue yet. Add one to get started.'
              : 'No books queued yet.'}
          </p>
        ) : canManage ? (
          <SortableQueue clubId={clubId} queue={queue} locale={locale} />
        ) : (
          <ul className="cstack" style={{ gap: 10 }}>
            {queue.map((book) => (
              <li key={book.id}>
                <ClubBookRow book={book} canManage={false} locale={locale} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManage && (
        <AddBookToClubModal
          clubId={clubId}
          open={addOpen}
          onOpenChange={setAddOpen}
        />
      )}
    </section>
  )
}

function SortableQueue({
  clubId,
  queue,
  locale,
}: {
  clubId: string
  queue: ClubBookRowType[]
  locale: string
}) {
  const [order, setOrder] = useState<ClubBookRowType[]>(queue)
  const [, startTransition] = useTransition()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  // Re-sync local state when the server returns a new queue prop (refresh).
  useEffect(() => {
    setOrder(queue)
  }, [queue])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = order.findIndex((b) => b.id === active.id)
    const newIndex = order.findIndex((b) => b.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const prev = order
    const next = arrayMove(order, oldIndex, newIndex)
    setOrder(next)

    startTransition(async () => {
      const result = await reorderClubQueueAction({
        clubId,
        orderedIds: next.map((b) => b.id),
      })
      if (!result.success) {
        setOrder(prev)
        toast.error(result.error)
      }
    })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={order.map((b) => b.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="cstack" style={{ gap: 10 }}>
          {order.map((book) => (
            <SortableItem key={book.id} id={book.id} book={book} locale={locale} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function SortableItem({
  id,
  book,
  locale,
}: {
  id: string
  book: ClubBookRowType
  locale: string
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }
  const handle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder"
      className="br-handle cursor-grab active:cursor-grabbing touch-none inline-flex items-center justify-center bg-transparent border-0 p-0"
      style={{ touchAction: 'none', color: 'inherit' }}
    >
      <GripVertical style={{ width: 14, height: 14 }} aria-hidden />
    </button>
  )
  return (
    <li ref={setNodeRef} style={style}>
      <ClubBookRow
        book={book}
        canManage={true}
        locale={locale}
        handleSlot={handle}
      />
    </li>
  )
}
