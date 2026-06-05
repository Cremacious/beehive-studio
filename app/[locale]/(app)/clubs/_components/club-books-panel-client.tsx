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
 * Non-managers get a static <ul>; empty queue gets an empty state.
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
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-comfortaa font-bold text-xl text-[var(--brand)]">
          Up next
        </h2>
        {canManage && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-pill)] text-sm font-semibold"
            style={{
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add book
          </button>
        )}
      </div>

      {queue.length === 0 ? (
        <p className="text-[var(--canvas-dark-ink-muted)] italic">
          {canManage
            ? 'No books in the queue yet. Add one to get started.'
            : 'No books queued yet.'}
        </p>
      ) : canManage ? (
        <SortableQueue clubId={clubId} queue={queue} locale={locale} />
      ) : (
        <ul className="flex flex-col gap-3">
          {queue.map((book) => (
            <li key={book.id}>
              <ClubBookRow book={book} canManage={false} locale={locale} />
            </li>
          ))}
        </ul>
      )}

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
        <ul className="flex flex-col gap-3">
          {order.map((book) => (
            <SortableItem key={book.id} id={book.id}>
              <ClubBookRow book={book} canManage={true} locale={locale} />
            </SortableItem>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function SortableItem({
  id,
  children,
}: {
  id: string
  children: React.ReactNode
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
  return (
    <li ref={setNodeRef} style={style} className="flex items-stretch gap-2">
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="shrink-0 flex items-center justify-center px-1 rounded-md text-[var(--canvas-dark-ink-muted)] hover:text-[var(--canvas-dark-ink-strong)] cursor-grab active:cursor-grabbing touch-none"
        style={{ touchAction: 'none' }}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <div className="flex-1 min-w-0">{children}</div>
    </li>
  )
}
