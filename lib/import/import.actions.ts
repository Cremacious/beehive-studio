'use server'

import { db } from '@/db'
import { binderItems, chapters } from '@/db/schema'
import { eq, and, desc, isNull } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { requireAuth } from '@/lib/require-auth'
import { assertBookOwner } from '@/lib/actions/_helpers'
import { getUserPremiumStatus } from '@/lib/premium'
import { isBookOverflow } from '@/lib/billing/book-overflow'
import { importLimiter } from '@/lib/rate-limit'
import {
  validateDocumentFile,
  detectFormat,
  type ImportFormat,
} from '@/lib/upload/validate-document'
import { parseDocument, ImportError } from './parse-document'
import { splitChapters } from './split-chapters'
import type { ImportedChapter, ImportPreview } from './types'
import type { ActionResult } from '@/lib/actions/book.actions'
import type { BinderItemRow } from '@/lib/actions/binder.actions'

// Defensive caps so a hostile/huge payload can't blow up persistence.
const MAX_CHAPTERS = 500
const MAX_TITLE_LEN = 200

function sanitizeTitle(title: string, index: number): string {
  const trimmed = (title ?? '').trim().slice(0, MAX_TITLE_LEN)
  return trimmed.length > 0 ? trimmed : `Chapter ${index + 1}`
}

function parseAllowedFormats(raw: FormDataEntryValue | null): readonly ImportFormat[] | undefined {
  if (typeof raw !== 'string' || raw.length === 0) return undefined
  const parts = raw.split(',').map((p) => p.trim())
  const valid = parts.filter((p): p is ImportFormat => p === 'docx' || p === 'pdf' || p === 'epub')
  return valid.length > 0 ? valid : undefined
}

function filenameToTitle(filename: string): string | null {
  const base = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  return base.length > 0 ? base : null
}

/**
 * Validate + parse + split an uploaded file into a preview. Does NOT write any
 * DB rows — the caller shows the detected chapters and the user confirms before
 * commit. Premium-gated and rate-limited before any parsing work.
 *
 * `allowedFormats` (comma-joined in the FormData) lets the caller restrict the
 * accepted set — append mode passes "docx,pdf".
 */
export async function parseImportAction(
  formData: FormData,
): Promise<ActionResult<ImportPreview>> {
  let userId: string
  try {
    userId = await requireAuth()
  } catch {
    return { success: false, error: 'UNAUTHORIZED' }
  }

  // Premium gate BEFORE any parsing work.
  const isPremium = await getUserPremiumStatus(userId)
  if (!isPremium) {
    return { success: false, error: 'PREMIUM_REQUIRED:import' }
  }

  const { success: allowed } = await importLimiter.limit(userId)
  if (!allowed) {
    return { success: false, error: 'Too many imports. Please wait a bit and try again.' }
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return { success: false, error: 'No file was uploaded.' }
  }

  const allowedFormats = parseAllowedFormats(formData.get('allowedFormats'))
  const validationError = validateDocumentFile(
    { name: file.name, type: file.type, size: file.size },
    { allowedFormats },
  )
  if (validationError) {
    return { success: false, error: validationError }
  }

  const format = detectFormat({ name: file.name, type: file.type }) as ImportFormat

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = await parseDocument(buffer, format)
    const chaptersOut = splitChapters(parsed)
    if (chaptersOut.length === 0) {
      return { success: false, error: 'No readable text found in this file.' }
    }
    const detectedTitle = parsed.detectedTitle ?? filenameToTitle(file.name)
    return {
      success: true,
      data: { chapters: chaptersOut.slice(0, MAX_CHAPTERS), detectedTitle },
    }
  } catch (err) {
    if (err instanceof ImportError) {
      return { success: false, error: err.message }
    }
    console.error('[import] parse failed:', err)
    return { success: false, error: "We couldn't read this file. Please try again." }
  }
}

/**
 * Append already-parsed chapters to an existing book (editor binder import).
 * Premium-gated + ownership-checked. Persists the binder items + chapter rows
 * in ONE transaction (all-or-nothing).
 */
export async function commitImportAction(input: {
  bookId: string
  chapters: ImportedChapter[]
}): Promise<ActionResult<{ count: number; items: BinderItemRow[] }>> {
  let userId: string
  try {
    userId = await requireAuth()
  } catch {
    return { success: false, error: 'UNAUTHORIZED' }
  }

  const isPremium = await getUserPremiumStatus(userId)
  if (!isPremium) {
    return { success: false, error: 'PREMIUM_REQUIRED:import' }
  }

  try {
    await assertBookOwner(input.bookId, userId)
  } catch {
    return { success: false, error: 'Book not found or access denied.' }
  }

  if (await isBookOverflow(userId, input.bookId)) {
    return { success: false, error: 'FREE_LIMIT_REACHED' }
  }

  const incoming = (input.chapters ?? []).slice(0, MAX_CHAPTERS)
  if (incoming.length === 0) {
    return { success: false, error: 'No chapters to import.' }
  }

  // Append after the current max root-level order.
  const existing = await db
    .select({ order: binderItems.order })
    .from(binderItems)
    .where(and(eq(binderItems.bookId, input.bookId), isNull(binderItems.parentId)))
    .orderBy(desc(binderItems.order))
    .limit(1)
  const startOrder = (existing[0]?.order ?? -1) + 1

  const now = new Date()
  const created: BinderItemRow[] = []

  await db.transaction(async (tx) => {
    for (let i = 0; i < incoming.length; i++) {
      const ch = incoming[i]
      const binderId = createId()
      const chapterId = createId()
      const title = sanitizeTitle(ch.title, i)
      const order = startOrder + i
      await tx.insert(binderItems).values({
        id: binderId,
        bookId: input.bookId,
        parentId: null,
        type: 'chapter',
        title,
        order,
        authorId: userId,
        lastEditedBy: userId,
      })
      await tx.insert(chapters).values({
        id: chapterId,
        bookId: input.bookId,
        binderItemId: binderId,
        content: ch.content,
        wordCount: typeof ch.wordCount === 'number' ? ch.wordCount : 0,
      })
      created.push({
        id: binderId,
        bookId: input.bookId,
        parentId: null,
        type: 'chapter',
        title,
        order,
        content: null,
        authorId: userId,
        lastEditedBy: userId,
        chapterId,
        chapterStatus: 'FIRST_DRAFT',
        createdAt: now,
        updatedAt: now,
      })
    }
  })

  return { success: true, data: { count: incoming.length, items: created } }
}
