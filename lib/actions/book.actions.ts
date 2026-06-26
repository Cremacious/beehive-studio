'use server'

import { db } from '@/db'
import {
  books, binderItems, chapters, bookTemplates, bookPublishingMetadata, hives,
} from '@/db/schema'
import { eq, and, count, inArray, gt, ne, sql } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { assertBookOwner } from './_helpers'
import { getUserPremiumStatus, FREE_BOOK_LIMIT } from '@/lib/premium'
import { createBookSchema, updateBookSchema, updateBookDetailsSchema } from '@/lib/validations/book'
import { createId } from '@paralleldrive/cuid2'
import { revalidatePath } from 'next/cache'
import { summarizeBookStatus, type BookSummaryStatus } from '@/lib/books/summarize-status'
import { scopedBooksForUser } from '@/lib/books/scoped'
import { extractWordCount } from '@/lib/tiptap-utils'
import type { ImportedChapter } from '@/lib/import/types'
import { recordSocialActivityTx } from '@/lib/social/record-activity'
import { deleteCloudinaryImage, getCloudinaryPublicId } from '@/lib/cloudinary'
import { runAction } from './safe-action'
import { cachedAction } from '@/lib/cache'

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
  seriesName: string | null
  seriesNumber: number | null
  hiveId: string | null
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
    .where(scopedBooksForUser(userId))
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
  visibility?: 'PRIVATE' | 'PUBLIC' | 'FRIENDS'
  discoverable?: boolean
  // Optional parsed chapters from an import (premium "Import a manuscript" path).
  // When present, they're inserted as root-level chapters in the SAME
  // transaction that creates the book, so an imported book is fully atomic.
  importedChapters?: ImportedChapter[]
}): Promise<ActionResult<{ bookId: string }>> {
  return runAction(async () => {
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

  // Importing a manuscript is premium-only — reject a free user who supplies a
  // chapters payload directly, before any rows are written.
  const importedChapters = (input.importedChapters ?? []).slice(0, 500)
  if (importedChapters.length > 0 && !isPremium) {
    return { success: false, error: 'PREMIUM_REQUIRED:import' }
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
      visibility: d.visibility,
      discoverable: d.discoverable,
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

    // Imported chapters (premium "Import a manuscript" path). Inserted as
    // root-level chapters in the same transaction so the book + its chapters
    // land atomically. Import never combines with a template in the UI, so
    // ordering from 0 is clean.
    for (let i = 0; i < importedChapters.length; i++) {
      const ch = importedChapters[i]
      const chapterBinderId = createId()
      const title = (ch.title ?? '').trim().slice(0, 200) || `Chapter ${i + 1}`
      await tx.insert(binderItems).values({
        id: chapterBinderId,
        bookId,
        parentId: null,
        type: 'chapter',
        title,
        order: i,
        authorId: userId,
        lastEditedBy: userId,
      })
      await tx.insert(chapters).values({
        id: createId(),
        bookId,
        binderItemId: chapterBinderId,
        content: ch.content,
        wordCount: extractWordCount(ch.content),
      })
    }
  })

  return { success: true, data: { bookId } }
  })
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
      seriesName: books.seriesName,
      seriesNumber: books.seriesNumber,
      hiveId: hives.id,
    })
    .from(books)
    .leftJoin(hives, eq(hives.bookId, books.id))
    .where(scopedBooksForUser(userId))
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
      seriesName: book.seriesName,
      seriesNumber: book.seriesNumber,
      hiveId: book.hiveId,
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
  // Issue #37: 4 parallel aggregate counts for the studio library header. Plain
  // numbers (JSON-safe). Short TTL so a writer's own stats lag at most a minute.
  const data = await cachedAction(
    `studio:stats:v1:${userId}`,
    () => computeStudioStats(userId),
    60,
  )
  return { success: true, data }
}

async function computeStudioStats(userId: string): Promise<StudioStats> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)

  const userBooksSq = db
    .select({ id: books.id, status: books.status })
    .from(books)
    .where(scopedBooksForUser(userId))
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
        .where(and(scopedBooksForUser(userId), ne(books.status, 'PUBLISHED'))),

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
    totalWords: Number(totalWordsRow[0]?.total ?? 0),
    booksInProgress: Number(booksInProgressRow[0]?.total ?? 0),
    wordsThisWeek: Number(wordsThisWeekRow[0]?.total ?? 0),
    chaptersPublished: Number(chaptersPublishedRow[0]?.total ?? 0),
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
    visibility: 'PRIVATE' | 'PUBLIC' | 'FRIENDS'
    status: 'DRAFT' | 'PUBLISHED'
    coverUrl: string | null
    synopsis: string | null
    createdAt: Date
    updatedAt: Date
  }>
> {
  const userId = await requireAuth()

  const book = await db.query.books.findFirst({
    where: and(eq(books.id, bookId), scopedBooksForUser(userId)),
    columns: {
      id: true, title: true, genre: true, visibility: true,
      status: true, coverUrl: true, synopsis: true,
      createdAt: true, updatedAt: true,
    },
  })

  if (!book) return { success: false, error: 'Book not found' }

  // scopedBooksForUser guarantees status !== 'STANDALONE_HIVE_SHADOW'.
  return { success: true, data: { ...book, status: book.status as 'DRAFT' | 'PUBLISHED' } }
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
  return runAction(async () => {
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

  // D1: first_publicly_discoverable_at — set IF the new state is PUBLIC AND discoverable
  // AND the column is currently NULL. updateBookAction's input schema doesn't surface
  // `discoverable`, so we read it from the existing row to compute the next state.
  if (updates.visibility === 'PUBLIC') {
    const existing = await db.query.books.findFirst({
      where: eq(books.id, bookId),
      columns: { discoverable: true, firstPubliclyDiscoverableAt: true },
    })
    if (existing && existing.discoverable === true && existing.firstPubliclyDiscoverableAt == null) {
      updates.firstPubliclyDiscoverableAt = new Date()
    }
  }

  await db
    .update(books)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(books.id, bookId))

  return { success: true, data: undefined }
  })
}

/**
 * Publishes a book: sets visibility to PUBLIC and status to PUBLISHED.
 */
export async function publishBookAction(bookId: string): Promise<ActionResult> {
  return runAction(async () => {
  const userId = await requireAuth()
  await assertBookOwner(bookId, userId)

  await db.transaction(async (tx) => {
    // D1: read existing row first so we can decide whether to stamp
    // first_publicly_discoverable_at as part of the update (gate: PUBLIC + discoverable
    // AND currently NULL). publishBookAction always sets visibility=PUBLIC.
    const [existing] = await tx
      .select({
        discoverable: books.discoverable,
        firstPubliclyDiscoverableAt: books.firstPubliclyDiscoverableAt,
      })
      .from(books)
      .where(eq(books.id, bookId))
      .limit(1)

    const updates: Partial<typeof books.$inferInsert> = {
      visibility: 'PUBLIC',
      status: 'PUBLISHED',
      updatedAt: new Date(),
    }
    if (existing && existing.discoverable === true && existing.firstPubliclyDiscoverableAt == null) {
      updates.firstPubliclyDiscoverableAt = new Date()
    }

    await tx
      .update(books)
      .set(updates)
      .where(eq(books.id, bookId))

    // C1 T8 hook: book_published. publishBookAction always sets visibility=PUBLIC;
    // discoverable is independent (spec §3.4 gate requires both).
    const [book] = await tx
      .select({ title: books.title, discoverable: books.discoverable })
      .from(books)
      .where(eq(books.id, bookId))
      .limit(1)
    if (book && book.discoverable === true) {
      await recordSocialActivityTx(tx, {
        actorId: userId,
        type: 'book_published',
        subjectType: 'book',
        subjectId: bookId,
        payload: { title: book.title },
      })
    }
  })

  return { success: true, data: undefined }
  })
}

/**
 * Unpublishes a book: sets visibility to PRIVATE and status to DRAFT.
 */
export async function unpublishBookAction(bookId: string): Promise<ActionResult> {
  return runAction(async () => {
  const userId = await requireAuth()
  await assertBookOwner(bookId, userId)

  await db
    .update(books)
    .set({ visibility: 'PRIVATE', status: 'DRAFT', updatedAt: new Date() })
    .where(eq(books.id, bookId))

  return { success: true, data: undefined }
  })
}

/**
 * Deletes a book and all its content. Cascade deletes handle
 * binder_items, chapters, chapter_snapshots, etc.
 */
export async function deleteBookAction(bookId: string, locale: string): Promise<ActionResult> {
  return runAction(async () => {
  const userId = await requireAuth()
  await assertBookOwner(bookId, userId)

  // Capture cover URL before delete so we can clean up the Cloudinary asset.
  const existing = await db.query.books.findFirst({
    where: eq(books.id, bookId),
    columns: { coverUrl: true },
  })

  await db.delete(books).where(and(eq(books.id, bookId), scopedBooksForUser(userId)))

  // Best-effort Cloudinary cleanup. Non-fatal.
  if (existing?.coverUrl) {
    try {
      const publicId = getCloudinaryPublicId(existing.coverUrl)
      if (publicId && publicId.startsWith('covers/')) {
        await deleteCloudinaryImage(publicId)
      }
    } catch {
      // Non-fatal
    }
  }

  revalidatePath(`/${locale}/studio`)

  return { success: true, data: undefined }
  })
}

// ─── Book details (full edit form) ────────────────────────────────────────────

export type BookDetails = {
  // Basics
  id: string
  title: string
  synopsis: string | null
  coverUrl: string | null
  // Discovery
  genre: string | null
  subgenre: string | null
  tags: string[]
  targetAudience: string | null
  contentWarnings: string[]
  compTitles: string[]
  language: string | null
  // Structure
  seriesName: string | null
  seriesNumber: number | null
  // Visibility + discovery
  visibility: 'PRIVATE' | 'PUBLIC' | 'FRIENDS'
  discoverable: boolean
  // Publishing (premium-gated for edits other than subtitle)
  subtitle: string | null
  publisherName: string | null
  trimSize: string | null
  edition: string | null
  isbn: string | null
  authorBio: string | null
  dedication: string | null
}

/**
 * Returns the full book detail set — both `books` columns and the optional
 * `bookPublishingMetadata` row — for the Book Details editor page.
 */
export async function getBookDetailsAction(
  bookId: string,
): Promise<ActionResult<BookDetails>> {
  const userId = await requireAuth()
  await assertBookOwner(bookId, userId)

  const book = await db.query.books.findFirst({ where: eq(books.id, bookId) })
  if (!book) return { success: false, error: 'Book not found' }

  const pm = await db.query.bookPublishingMetadata.findFirst({
    where: eq(bookPublishingMetadata.bookId, bookId),
  })

  return {
    success: true,
    data: {
      id: book.id,
      title: book.title,
      synopsis: book.synopsis,
      coverUrl: book.coverUrl,
      genre: book.genre,
      subgenre: book.subgenre,
      tags: book.tags ?? [],
      targetAudience: book.targetAudience,
      contentWarnings: book.contentWarnings ?? [],
      compTitles: book.compTitles ?? [],
      language: book.language,
      seriesName: book.seriesName,
      seriesNumber: book.seriesNumber,
      visibility: book.visibility,
      discoverable: book.discoverable,
      subtitle: pm?.subtitle ?? null,
      publisherName: pm?.publisherName ?? null,
      trimSize: pm?.trimSize ?? null,
      edition: pm?.edition ?? null,
      isbn: pm?.isbn ?? null,
      authorBio: pm?.authorBio ?? null,
      dedication: pm?.dedication ?? null,
    },
  }
}

/**
 * Updates every field captured at creation EXCEPT the premium-gated
 * publishing fields beyond subtitle (publisherName/trimSize/edition/isbn/
 * authorBio/dedication go through updatePublishingMetadataAction).
 *
 * Writes to both `books` and `bookPublishingMetadata` in a transaction.
 * If no publishing metadata row exists yet (legacy book), one is upserted.
 */
export async function updateBookDetailsAction(
  bookId: string,
  input: {
    title: string
    synopsis: string | null
    coverUrl: string | null
    genre: string | null
    subgenre: string | null
    tags: string[]
    targetAudience: string | null
    contentWarnings: string[]
    compTitles: string[]
    language: string | null
    seriesName: string | null
    seriesNumber: number | null
    subtitle: string | null
    visibility: 'PRIVATE' | 'PUBLIC' | 'FRIENDS'
    discoverable: boolean
  },
): Promise<ActionResult> {
  return runAction(async () => {
  const userId = await requireAuth()
  await assertBookOwner(bookId, userId)

  const parsed = updateBookDetailsSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }
  const d = parsed.data

  // Capture the existing cover URL so we can clean up the prior Cloudinary
  // asset after a successful update. Mirrors the avatar / club cleanup
  // pattern (lib/actions/avatar.actions.ts, lib/actions/book-clubs.actions.ts).
  const existingCover = await db.query.books.findFirst({
    where: eq(books.id, bookId),
    columns: { coverUrl: true },
  })
  const previousCoverUrl = existingCover?.coverUrl ?? null

  await db.transaction(async (tx) => {
    // D1: stamp first_publicly_discoverable_at on first transition to
    // (PUBLIC + discoverable) when the column is still NULL.
    const becomingPublic = d.visibility === 'PUBLIC' && d.discoverable === true
    let stampFirstPublic = false
    if (becomingPublic) {
      const current = await tx.query.books.findFirst({
        where: eq(books.id, bookId),
        columns: { firstPubliclyDiscoverableAt: true },
      })
      if (current && current.firstPubliclyDiscoverableAt == null) {
        stampFirstPublic = true
      }
    }

    await tx
      .update(books)
      .set({
        title: d.title,
        synopsis: d.synopsis,
        coverUrl: d.coverUrl,
        genre: d.genre,
        subgenre: d.subgenre,
        tags: d.tags,
        targetAudience: d.targetAudience,
        contentWarnings: d.contentWarnings,
        compTitles: d.compTitles,
        language: d.language,
        seriesName: d.seriesName,
        seriesNumber: d.seriesNumber,
        visibility: d.visibility,
        discoverable: d.discoverable,
        updatedAt: new Date(),
        ...(stampFirstPublic ? { firstPubliclyDiscoverableAt: new Date() } : {}),
      })
      .where(eq(books.id, bookId))

    // Upsert subtitle on the publishing metadata row. Other fields on that
    // row stay untouched (premium-gated; updatePublishingMetadataAction owns them).
    const existing = await tx.query.bookPublishingMetadata.findFirst({
      where: eq(bookPublishingMetadata.bookId, bookId),
    })
    if (existing) {
      await tx
        .update(bookPublishingMetadata)
        .set({ subtitle: d.subtitle, updatedAt: new Date() })
        .where(eq(bookPublishingMetadata.bookId, bookId))
    } else {
      await tx.insert(bookPublishingMetadata).values({
        bookId,
        subtitle: d.subtitle,
      })
    }
  })

  // Best-effort cleanup of the prior Cloudinary cover when the URL changed
  // (replace or clear). Non-fatal — Cloudinary failure must never block the
  // user's save.
  if (previousCoverUrl && previousCoverUrl !== d.coverUrl) {
    try {
      const publicId = getCloudinaryPublicId(previousCoverUrl)
      if (publicId && publicId.startsWith('covers/')) {
        await deleteCloudinaryImage(publicId)
      }
    } catch {
      // Non-fatal
    }
  }

  return { success: true, data: undefined }
  })
}
