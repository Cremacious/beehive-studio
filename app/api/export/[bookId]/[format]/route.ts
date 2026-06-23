import { auth } from '@/lib/auth'
import { db } from '@/db'
import { books, binderItems, chapters, userProfiles, bookPublishingMetadata } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { headers } from 'next/headers'
import { generateDocx, type DocxStyle } from '@/lib/export/docx'
import { generateEpub } from '@/lib/export/epub'
import { generatePdf, type PdfStyle } from '@/lib/export/pdf'
import { buildExportInputs, type ExportRow } from '@/lib/export/build-export-inputs'
import { scopedBooksForUser } from '@/lib/books/scoped'

// pdfkit + html-to-docx rely on Node APIs — pin to the Node.js runtime.
export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookId: string; format: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id
  const { bookId, format } = await params

  if (format !== 'docx' && format !== 'epub' && format !== 'pdf') {
    return Response.json({ error: 'Invalid format' }, { status: 400 })
  }

  // Verify ownership
  const book = await db.query.books.findFirst({
    where: and(eq(books.id, bookId), scopedBooksForUser(userId)),
  })
  if (!book) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  // Fetch author name
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
    columns: { displayName: true, username: true },
  })
  const authorName = profile?.displayName ?? profile?.username ?? 'Unknown Author'

  // Fetch binder items with chapter content, ordered by position
  const rows = await db
    .select({
      id: binderItems.id,
      parentId: binderItems.parentId,
      type: binderItems.type,
      title: binderItems.title,
      order: binderItems.order,
      chapterId: chapters.id,
      chapterContent: chapters.content,
      chapterStatus: chapters.status,
      chapterUpdatedAt: chapters.updatedAt,
      binderContent: binderItems.content,
    })
    .from(binderItems)
    .leftJoin(chapters, eq(chapters.binderItemId, binderItems.id))
    .where(eq(binderItems.bookId, bookId))
    .orderBy(asc(binderItems.order))

  const { chapters: chapterInputs, all: allInputs } = buildExportInputs(rows as ExportRow[])

  if (chapterInputs.length === 0) {
    return Response.json({ error: 'No chapters to export' }, { status: 400 })
  }

  const safeTitle = book.title.replace(/[^a-z0-9\s-]/gi, '').trim() || 'export'

  try {
    if (format === 'docx') {
      const url = new URL(request.url)
      const styleParam = url.searchParams.get('style') ?? 'manuscript'
      const validStyle: DocxStyle = styleParam === 'basic' ? 'basic' : 'manuscript'

      const buffer = await generateDocx(allInputs, validStyle, book.title, authorName)
      const filename = `${safeTitle}-${validStyle}.docx`

      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    if (format === 'pdf') {
      const url = new URL(request.url)
      const styleParam = url.searchParams.get('style') ?? 'manuscript'
      const validStyle: PdfStyle = styleParam === 'basic' ? 'basic' : 'manuscript'

      const buffer = await generatePdf(allInputs, validStyle, book.title, authorName)
      const filename = `${safeTitle}.pdf`

      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    // EPUB — fetch ISBN from publishing metadata if available
    const meta = await db.query.bookPublishingMetadata
      .findFirst({
        where: eq(bookPublishingMetadata.bookId, bookId),
        columns: { isbn: true },
      })
      .catch(() => null)

    const buffer = await generateEpub(allInputs, book.title, authorName, meta?.isbn ?? null)
    const filename = `${safeTitle}.epub`

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/epub+zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    // Never leak a stack trace / 500 unhandled — the generators are defensive,
    // but a malformed doc should still produce a controlled response.
    console.error(`[export] ${format} generation failed for book ${bookId}:`, err)
    return Response.json({ error: 'Export failed. Please try again.' }, { status: 500 })
  }
}
