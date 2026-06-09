'use server'

import { db } from '@/db'
import { hiveSubmissions, hiveSuggestions, hiveAnnotations, chapters, books } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Bell deep-link resolvers for HIVE_* + NEW_CHAPTER notifications.
 *
 * Each takes the notification's `resourceId` and looks up the surrounding
 * context (hiveId + chapterId, or bookId) so the bell can route to the
 * canonical deep URL. Falls back to the closest parent hub on failure.
 */

export async function resolveHiveSubmissionLink(
  submissionId: string,
  locale: string,
): Promise<string> {
  const row = await db.query.hiveSubmissions.findFirst({
    where: eq(hiveSubmissions.id, submissionId),
    columns: { hiveId: true },
  })
  if (!row) return `/${locale}/community`
  return `/${locale}/hive/${row.hiveId}/submissions/${submissionId}`
}

export async function resolveHiveSuggestionLink(
  suggestionId: string,
  locale: string,
): Promise<string> {
  const row = await db.query.hiveSuggestions.findFirst({
    where: eq(hiveSuggestions.id, suggestionId),
    columns: { hiveId: true, chapterId: true },
  })
  if (!row) return `/${locale}/community`
  return `/${locale}/hive/${row.hiveId}/chapters/${row.chapterId}#sug-${suggestionId}`
}

export async function resolveHiveAnnotationLink(
  annotationId: string,
  locale: string,
): Promise<string> {
  const row = await db.query.hiveAnnotations.findFirst({
    where: eq(hiveAnnotations.id, annotationId),
    columns: { hiveId: true, chapterId: true },
  })
  if (!row) return `/${locale}/community`
  return `/${locale}/hive/${row.hiveId}/chapters/${row.chapterId}#ann-${annotationId}`
}

export async function resolveNewChapterLink(
  chapterId: string,
  locale: string,
): Promise<string> {
  const row = await db.query.chapters.findFirst({
    where: eq(chapters.id, chapterId),
    columns: { bookId: true },
  })
  if (!row) return `/${locale}/discover`
  // Verify book still exists (covers FK orphan edge case).
  const book = await db.query.books.findFirst({
    where: eq(books.id, row.bookId),
    columns: { id: true },
  })
  if (!book) return `/${locale}/discover`
  return `/${locale}/books/${row.bookId}/read/${chapterId}`
}
