'use server'

import { db } from '@/db'
import { books, bookPublishingMetadata, exportPresets } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { assertBookOwner } from './_helpers'
import { getUserPremiumStatus } from '@/lib/premium'
import { updatePublishingMetadataSchema } from '@/lib/validations/book'
import type { ActionResult } from './book.actions'
import { runAction } from './safe-action'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PublishingMetadata = {
  bookId: string
  isbn: string | null
  subtitle: string | null
  trimSize: string | null
  authorBio: string | null
  dedication: string | null
  publisherName: string | null
  edition: string | null
}

export type ExportPreset = {
  id: string
  name: string
  format: 'EPUB' | 'PDF' | 'DOCX' | 'TXT' | 'ZIP'
  config: unknown
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Returns publishing metadata for a book.
 * Returns defaults if no metadata row exists yet.
 */
export async function getPublishingMetadataAction(
  bookId: string,
): Promise<ActionResult<PublishingMetadata>> {
  return runAction(async () => {
  const userId = await requireAuth()
  await assertBookOwner(bookId, userId)

  const meta = await db.query.bookPublishingMetadata.findFirst({
    where: eq(bookPublishingMetadata.bookId, bookId),
  })

  if (!meta) {
    // Return defaults — row is created on first update
    return {
      success: true,
      data: {
        bookId,
        isbn: null,
        subtitle: null,
        trimSize: '6x9',
        authorBio: null,
        dedication: null,
        publisherName: null,
        edition: 'First Edition',
      },
    }
  }

  return {
    success: true,
    data: {
      bookId: meta.bookId,
      isbn: meta.isbn,
      subtitle: meta.subtitle,
      trimSize: meta.trimSize,
      authorBio: meta.authorBio,
      dedication: meta.dedication,
      publisherName: meta.publisherName,
      edition: meta.edition,
    },
  }
  })
}

/**
 * Updates publishing metadata. Premium-gated.
 * Creates the metadata row if it doesn't exist.
 */
export async function updatePublishingMetadataAction(
  bookId: string,
  input: {
    isbn?: string | null
    subtitle?: string | null
    trimSize?: string
    authorBio?: string | null
    dedication?: string | null
    publisherName?: string | null
    edition?: string
  },
): Promise<ActionResult> {
  return runAction(async () => {
  const userId = await requireAuth()

  const isPremium = await getUserPremiumStatus(userId)
  if (!isPremium) {
    return { success: false, error: 'PREMIUM_REQUIRED:publishing_metadata' }
  }

  const parsed = updatePublishingMetadataSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  await assertBookOwner(bookId, userId)

  // Build the set object explicitly — only include defined fields so that
  // omitted fields are not overwritten with NULL in the SQL SET clause.
  const updateSet: Partial<typeof bookPublishingMetadata.$inferInsert> & { updatedAt?: Date } = {
    updatedAt: new Date(),
  }
  if (parsed.data.isbn !== undefined) updateSet.isbn = parsed.data.isbn
  if (parsed.data.subtitle !== undefined) updateSet.subtitle = parsed.data.subtitle
  if (parsed.data.trimSize !== undefined) updateSet.trimSize = parsed.data.trimSize
  if (parsed.data.authorBio !== undefined) updateSet.authorBio = parsed.data.authorBio
  if (parsed.data.dedication !== undefined) updateSet.dedication = parsed.data.dedication
  if (parsed.data.publisherName !== undefined) updateSet.publisherName = parsed.data.publisherName
  if (parsed.data.edition !== undefined) updateSet.edition = parsed.data.edition

  // Skip the DB round-trip if no fields were actually provided
  if (Object.keys(updateSet).length === 1) {
    // Only updatedAt is in updateSet — no real changes
    return { success: true, data: undefined }
  }

  await db
    .insert(bookPublishingMetadata)
    .values({
      bookId,
      isbn: parsed.data.isbn ?? null,
      subtitle: parsed.data.subtitle ?? null,
      trimSize: parsed.data.trimSize ?? '6x9',
      authorBio: parsed.data.authorBio ?? null,
      dedication: parsed.data.dedication ?? null,
      publisherName: parsed.data.publisherName ?? null,
      edition: parsed.data.edition ?? 'First Edition',
    })
    .onConflictDoUpdate({
      target: bookPublishingMetadata.bookId,
      set: updateSet,
    })

  return { success: true, data: undefined }
  })
}

/**
 * Returns all system export presets (seeded in Phase 1).
 * Visible to all users; export itself is premium-gated in the UI.
 */
export async function getExportPresetsAction(): Promise<ActionResult<ExportPreset[]>> {
  return runAction(async () => {
  await requireAuth()

  const presets = await db
    .select({
      id: exportPresets.id,
      name: exportPresets.name,
      format: exportPresets.format,
      config: exportPresets.config,
    })
    .from(exportPresets)
    .where(eq(exportPresets.isSystemPreset, true))
    .orderBy(exportPresets.name)

  return { success: true, data: presets }
  })
}
