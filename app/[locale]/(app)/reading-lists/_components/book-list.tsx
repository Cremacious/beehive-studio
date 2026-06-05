import type { ListBookRow } from '@/lib/actions/reading-lists.actions'
import type { DerivedBookRow } from '@/lib/reading-lists/liked-list-books'
import { BookRow } from './book-row'

type Props = {
  books: (ListBookRow | DerivedBookRow)[]
  listId: string
  isOwner: boolean
  locale: string
}

/**
 * T10 stub. T13 will enrich with dnd-kit DndContext + SortableContext
 * for owner+CUSTOM lists; static <ul> for viewers and Liked lists.
 */
export function BookList({ books, listId, isOwner, locale }: Props) {
  void listId
  if (books.length === 0) {
    return (
      <p className="text-[var(--canvas-dark-ink-muted)] italic mt-6">
        No books yet.
      </p>
    )
  }
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
