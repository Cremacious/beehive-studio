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
import { GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import type { ListBookRow } from '@/lib/actions/reading-lists.actions'
import type { DerivedBookRow } from '@/lib/reading-lists/liked-list-books'
import { reorderListBooksAction } from '@/lib/actions/reading-lists.actions'
import { BookRow } from './book-row'

type AnyBook = ListBookRow | DerivedBookRow

type Props = {
  books: AnyBook[]
  listId: string
  isOwner: boolean
  locale: string
}

/**
 * T13 enriched: owner + CUSTOM lists get dnd-kit drag-to-reorder; Liked
 * lists and non-owner viewers get a plain <ul>. Liked rows are detected
 * via their synthetic `liked-` id prefix so the public prop signature
 * stays unchanged.
 */
export function BookList({ books, listId, isOwner, locale }: Props) {
  // Liked-derived rows are immutable on the server (reorder action returns
  // LIKED_LIST_IMMUTABLE). Detect them so we don't render drag handles.
  const isLikedList = books.length > 0 && books[0].id.startsWith('liked-')
  const sortable = isOwner && !isLikedList

  if (books.length === 0) {
    return (
      <p className="text-[var(--canvas-dark-ink-muted)] italic mt-6">
        No books yet.
      </p>
    )
  }

  if (!sortable) {
    return (
      <ul className="space-y-3 mt-4">
        {books.map((book) => (
          <li key={book.id}>
            <BookRow book={book} isOwner={isOwner} locale={locale} />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <SortableBookList
      books={books}
      listId={listId}
      isOwner={isOwner}
      locale={locale}
    />
  )
}

function SortableBookList({ books, listId, isOwner, locale }: Props) {
  const [order, setOrder] = useState<AnyBook[]>(books)
  const [, startTransition] = useTransition()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  // Re-sync local state when the server returns a new books prop (refresh).
  useEffect(() => {
    setOrder(books)
  }, [books])

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
      const result = await reorderListBooksAction({
        listId,
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
        <ul className="space-y-3 mt-4">
          {order.map((book) => (
            <SortableItem
              key={book.id}
              id={book.id}
              book={book}
              isOwner={isOwner}
              locale={locale}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function SortableItem({
  id,
  book,
  isOwner,
  locale,
}: {
  id: string
  book: AnyBook
  isOwner: boolean
  locale: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })
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
      <BookRow
        book={book}
        isOwner={isOwner}
        locale={locale}
        handleSlot={handle}
      />
    </li>
  )
}
