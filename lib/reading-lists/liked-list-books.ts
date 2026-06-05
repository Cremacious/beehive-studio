import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { books } from '@/db/schema/books';
import { userProfiles } from '@/db/schema/auth';
import { bookLikes } from '@/db/schema/social';

/**
 * Derived row shape for books surfaced via the Liked auto-list. The Liked list
 * has no `reading_list_books` rows of its own — its contents are derived from
 * `book_likes` for the owner. We synthesize stable ids (`liked-<bookId>`) so
 * React keys don't collide with real `reading_list_books.id` values elsewhere
 * in the UI.
 */
export type DerivedBookRow = {
  id: string; // synthetic — `liked-${bookId}`
  listId: string;
  bookId: string;
  title: string;
  author: string;
  coverUrl: string | null;
  isRead: boolean; // always false for derived rows
  rating: null;
  commentary: null;
  order: number; // index by recency
  addedAt: Date; // = bookLikes.createdAt
};

/**
 * Read the books the owner has liked, projected into the Liked-list row
 * shape. Author falls back: profile displayName → username → 'Unknown author'.
 */
export async function getLikedListBooks(
  userId: string,
  likedListId: string,
): Promise<DerivedBookRow[]> {
  const rows = await db
    .select({
      bookId: bookLikes.bookId,
      likedAt: bookLikes.createdAt,
      bookTitle: books.title,
      bookCoverUrl: books.coverUrl,
      authorUserId: books.userId,
      authorUsername: userProfiles.username,
      authorDisplayName: userProfiles.displayName,
    })
    .from(bookLikes)
    .innerJoin(books, eq(bookLikes.bookId, books.id))
    .leftJoin(userProfiles, eq(userProfiles.userId, books.userId))
    .where(eq(bookLikes.userId, userId))
    .orderBy(desc(bookLikes.createdAt));

  return rows.map((r, i) => ({
    id: `liked-${r.bookId}`,
    listId: likedListId,
    bookId: r.bookId,
    title: r.bookTitle,
    author: r.authorDisplayName ?? r.authorUsername ?? 'Unknown author',
    coverUrl: r.bookCoverUrl,
    isRead: false,
    rating: null,
    commentary: null,
    order: i,
    addedAt: r.likedAt,
  }));
}
