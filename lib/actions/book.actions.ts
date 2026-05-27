'use server'

import { db } from '@/db'
import {
  books, binderItems, chapters, bookTemplates, bookPublishingMetadata,
} from '@/db/schema'
import { eq, and, count, inArray, gt, ne, sql } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { assertBookOwner } from './_helpers'
import { getUserPremiumStatus, FREE_BOOK_LIMIT } from '@/lib/premium'
import { createBookSchema, updateBookSchema } from '@/lib/validations/book'
import { createId } from '@paralleldrive/cuid2'
import { summarizeBookStatus, type BookSummaryStatus } from '@/lib/books/summarize-status'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BookSummary = {
  id: string
  title: string
  coverUrl: string | null
  wordCount: number
  genre: string | null
  lastEditedAt: Date
  chapterCount: number
  status: BookSummaryStatus
  isPublished: boolean
}

export type StudioStats = {
  totalWords: number
  booksInProgress: number
  wordsThisWeek: number
  chaptersPublished: number
}

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the count of active books for a user. */
async function getActiveBookCount(userId: string): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(books)
    .where(eq(books.userId, userId))
  return Number(result[0]?.count ?? 0)
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Creates a new book. If templateId is provided, seeds the binder with the
 * template structure. Free users are limited to FREE_BOOK_LIMIT active books.
 */
export async function createBookAction(input: {
  title: string
  subtitle?: string
  synopsis?: string
  coverUrl?: string | null
  genre?: string
  subgenre?: string
  tags?: string[]
  targetAudience?: string
  contentWarnings?: string[]
  compTitles?: string[]
  language?: string
  templateId?: string
  seriesName?: string
  seriesNumber?: number
  publisherName?: string
  trimSize?: string
  edition?: string
}): Promise<ActionResult<{ bookId: string }>> {
  const userId = await requireAuth()

  const parsed = createBookSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const isPremium = await getUserPremiumStatus(userId)
  if (!isPremium) {
    const currentCount = await getActiveBookCount(userId)
    if (currentCount >= FREE_BOOK_LIMIT) {
      return { success: false, error: 'FREE_LIMIT_REACHED' }
    }
  }

  const bookId = createId()
  const d = parsed.data

  await db.transaction(async (tx) => {
    await tx.insert(books).values({
      id: bookId,
      userId,
      title: d.title,
      genre: d.genre ?? null,
      coverUrl: d.coverUrl ?? null,
      synopsis: d.synopsis ?? null,
      subgenre: d.subgenre ?? null,
      tags: d.tags ?? null,
      targetAudience: d.targetAudience ?? null,
      language: d.language ?? null,
      contentWarnings: d.contentWarnings ?? null,
      compTitles: d.compTitles ?? null,
      seriesName: d.seriesName ?? null,
      seriesNumber: d.seriesNumber ?? null,
    })

    // Publishing metadata at creation time is intentionally free-tier — ongoing edits
    // via updatePublishingMetadataAction remain premium-gated.
    const hasMeta = d.subtitle !== undefined || d.publisherName !== undefined
      || d.trimSize !== undefined || d.edition !== undefined
    if (hasMeta) {
      await tx.insert(bookPublishingMetadata).values({
        bookId,
        subtitle: d.subtitle ?? null,
        publisherName: d.publisherName ?? null,
        trimSize: d.trimSize ?? '6×9',
        edition: d.edition ?? 'First Edition',
        isbn: null,
        authorBio: null,
        dedication: null,
      })
    }

    if (d.templateId) {
      const [template] = await tx
        .select()
        .from(bookTemplates)
        .where(eq(bookTemplates.id, d.templateId))

      if (template?.structure) {
        const structure = template.structure as {
          parts?: Array<{ title: string; chapterCount: number }>
          researchFolders?: string[]
        }

        let globalOrder = 0

        for (const part of structure.parts ?? []) {
          const partId = createId()
          await tx.insert(binderItems).values({
            id: partId,
            bookId,
            type: 'part',
            title: part.title,
            order: globalOrder++,
          })

          for (let i = 0; i < (part.chapterCount ?? 1); i++) {
            const chapterBinderId = createId()
            const chapterId = createId()

            await tx.insert(binderItems).values({
              id: chapterBinderId,
              bookId,
              parentId: partId,
              type: 'chapter',
              title: `Chapter ${i + 1}`,
              order: i,
            })

            await tx.insert(chapters).values({
              id: chapterId,
              bookId,
              binderItemId: chapterBinderId,
            })
          }
        }

        for (const folderName of structure.researchFolders ?? []) {
          await tx.insert(binderItems).values({
            bookId,
            type: 'research_folder',
            title: folderName,
            order: globalOrder++,
          })
        }
      }
    }
    // If no templateId is provided, the book is created with an empty binder.
    // The user creates their first chapter explicitly via the editor's empty
    // state CTA. Removed 2026-05-22 in SP2 — gives users naming agency from
    // the first keystroke.
  })

  return { success: true, data: { bookId } }
}

/**
 * Returns all books belonging to the authenticated user,
 * ordered by most recently updated.
 */
export async function getUserBooksAction(): Promise<
  ActionResult<BookSummary[]>
> {
  const userId = await requireAuth()

  // 1) Fetch all the user's books.
  const bookRows = await db
    .select({
      id: books.id,
      title: books.title,
      genre: books.genre,
      status: books.status,
      coverUrl: books.coverUrl,
      updatedAt: books.updatedAt,
    })
    .from(books)
    .where(eq(books.userId, userId))
    .orderBy(sql`${books.updatedAt} DESC`)

  if (bookRows.length === 0) return { success: true, data: [] }

  // 2) Fetch all chapters for those books in a single query.
  const bookIds = bookRows.map((b) => b.id)
  const chapterRows = await db
    .select({
      bookId: chapters.bookId,
      wordCount: chapters.wordCount,
      status: chapters.status,
      updatedAt: chapters.updatedAt,
    })
    .from(chapters)
    .where(inArray(chapters.bookId, bookIds))

  // 3) Zip in JS: per book, count chapters, find max(updatedAt), collect statuses.
  type ChapterAgg = {
    wordCount: number
    count: number
    maxUpdatedAt: Date
    statuses: ('IDEA' | 'OUTLINE' | 'FIRST_DRAFT' | 'REVISED' | 'FINAL')[]
  }
  const perBook = new Map<string, ChapterAgg>()
  for (const ch of chapterRows) {
    const existing = perBook.get(ch.bookId)
    if (existing) {
      existing.wordCount += ch.wordCount
      existing.count += 1
      if (ch.updatedAt > existing.maxUpdatedAt) existing.maxUpdatedAt = ch.updatedAt
      existing.statuses.push(ch.status)
    } else {
      perBook.set(ch.bookId, {
        wordCount: ch.wordCount,
        count: 1,
        maxUpdatedAt: ch.updatedAt,
        statuses: [ch.status],
      })
    }
  }

  const summaries: BookSummary[] = bookRows.map((book) => {
    const agg = perBook.get(book.id)
    const lastEditedAt = agg && agg.maxUpdatedAt > book.updatedAt ? agg.maxUpdatedAt : book.updatedAt
    return {
      id: book.id,
      title: book.title,
      coverUrl: book.coverUrl,
      wordCount: agg?.wordCount ?? 0,
      genre: book.genre,
      lastEditedAt,
      chapterCount: agg?.count ?? 0,
      status: summarizeBookStatus({
        bookStatus: book.status,
        chapterStatuses: agg?.statuses ?? [],
      }),
      isPublished: book.status === 'PUBLISHED',
    }
  })

  return { success: true, data: summaries }
}

/**
 * Aggregate stats for the /studio header strip.
 *
 * wordsThisWeek caveat: sums word counts for CHAPTERS UPDATED in the
 * last 7 days, not "words added this week" (we don't track per-day
 * deltas). Acceptable productivity proxy.
 */
export async function getStudioStatsAction(): Promise<ActionResult<StudioStats>> {
  const userId = await requireAuth()
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)

  const userBooksSq = db
    .select({ id: books.id, status: books.status })
    .from(books)
    .where(eq(books.userId, userId))
    .as('user_books')

  const [totalWordsRow, booksInProgressRow, wordsThisWeekRow, chaptersPublishedRow] =
    await Promise.all([
      // SUM(chapters.wordCount) for chapters of user's books
      db
        .select({ total: sql<number>`COALESCE(SUM(${chapters.wordCount}), 0)::int` })
        .from(chapters)
        .innerJoin(userBooksSq, eq(chapters.bookId, userBooksSq.id)),

      // COUNT(books) WHERE userId AND status <> 'PUBLISHED'
      db
        .select({ total: sql<number>`COUNT(*)::int` })
        .from(books)
        .where(and(eq(books.userId, userId), ne(books.status, 'PUBLISHED'))),

      // SUM(chapters.wordCount) WHERE chapter.updatedAt > sevenDaysAgo, scoped to user
      db
        .select({ total: sql<number>`COALESCE(SUM(${chapters.wordCount}), 0)::int` })
        .from(chapters)
        .innerJoin(userBooksSq, eq(chapters.bookId, userBooksSq.id))
        .where(gt(chapters.updatedAt, sevenDaysAgo)),

      // COUNT(chapters) WHERE chapter's book is PUBLISHED
      db
        .select({ total: sql<number>`COUNT(*)::int` })
        .from(chapters)
        .innerJoin(
          userBooksSq,
          and(eq(chapters.bookId, userBooksSq.id), eq(userBooksSq.status, 'PUBLISHED')),
        ),
    ])

  return {
    success: true,
    data: {
      totalWords: Number(totalWordsRow[0]?.total ?? 0),
      booksInProgress: Number(booksInProgressRow[0]?.total ?? 0),
      wordsThisWeek: Number(wordsThisWeekRow[0]?.total ?? 0),
      chaptersPublished: Number(chaptersPublishedRow[0]?.total ?? 0),
    },
  }
}

/**
 * Returns a single book by ID. The book must belong to the authenticated user.
 */
export async function getBookAction(bookId: string): Promise<
  ActionResult<{
    id: string
    title: string
    genre: string | null
    visibility: 'PRIVATE' | 'PUBLIC'
    status: 'DRAFT' | 'PUBLISHED'
    coverUrl: string | null
    synopsis: string | null
    createdAt: Date
    updatedAt: Date
  }>
> {
  const userId = await requireAuth()

  const book = await db.query.books.findFirst({
    where: and(eq(books.id, bookId), eq(books.userId, userId)),
    columns: {
      id: true, title: true, genre: true, visibility: true,
      status: true, coverUrl: true, synopsis: true,
      createdAt: true, updatedAt: true,
    },
  })

  if (!book) return { success: false, error: 'Book not found' }

  return { success: true, data: book }
}

/**
 * Updates mutable book fields. Only the book owner can update.
 */
export async function updateBookAction(
  bookId: string,
  input: {
    title?: string
    genre?: string | null
    synopsis?: string | null
    visibility?: 'PRIVATE' | 'PUBLIC'
    status?: 'DRAFT' | 'PUBLISHED'
    coverUrl?: string | null
  },
): Promise<ActionResult> {
  const userId = await requireAuth()

  const parsed = updateBookSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  await assertBookOwner(bookId, userId)

  const updates: Partial<typeof books.$inferInsert> = {}
  if (parsed.data.title !== undefined) updates.title = parsed.data.title
  if (parsed.data.genre !== undefined) updates.genre = parsed.data.genre
  if (parsed.data.synopsis !== undefined) updates.synopsis = parsed.data.synopsis
  if (parsed.data.visibility !== undefined) updates.visibility = parsed.data.visibility
  if (parsed.data.status !== undefined) updates.status = parsed.data.status
  if (parsed.data.coverUrl !== undefined) updates.coverUrl = parsed.data.coverUrl

  if (Object.keys(updates).length === 0) return { success: true, data: undefined }

  await db
    .update(books)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(books.id, bookId))

  return { success: true, data: undefined }
}

/**
 * Publishes a book: sets visibility to PUBLIC and status to PUBLISHED.
 */
export async function publishBookAction(bookId: string): Promise<ActionResult> {
  const userId = await requireAuth()
  await assertBookOwner(bookId, userId)

  await db
    .update(books)
    .set({ visibility: 'PUBLIC', status: 'PUBLISHED', updatedAt: new Date() })
    .where(eq(books.id, bookId))

  return { success: true, data: undefined }
}

/**
 * Unpublishes a book: sets visibility to PRIVATE and status to DRAFT.
 */
export async function unpublishBookAction(bookId: string): Promise<ActionResult> {
  const userId = await requireAuth()
  await assertBookOwner(bookId, userId)

  await db
    .update(books)
    .set({ visibility: 'PRIVATE', status: 'DRAFT', updatedAt: new Date() })
    .where(eq(books.id, bookId))

  return { success: true, data: undefined }
}

/**
 * Deletes a book and all its content. Cascade deletes handle
 * binder_items, chapters, chapter_snapshots, etc.
 */
export async function deleteBookAction(bookId: string): Promise<ActionResult> {
  const userId = await requireAuth()
  await assertBookOwner(bookId, userId)

  await db.delete(books).where(and(eq(books.id, bookId), eq(books.userId, userId)))

  return { success: true, data: undefined }
}
