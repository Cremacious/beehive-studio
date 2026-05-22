import { auth } from '@/lib/auth'
import { db } from '@/db'
import { books, binderItems, chapters, userProfiles, bookPublishingMetadata } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { headers } from 'next/headers'
import { generateDocx, type DocxStyle } from '@/lib/export/docx'
import { generateEpub } from '@/lib/export/epub'

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

  // PDF stub
  if (format === 'pdf') {
    return Response.json({ error: 'Print-ready PDF coming soon' }, { status: 501 })
  }

  if (format !== 'docx' && format !== 'epub') {
    return Response.json({ error: 'Invalid format' }, { status: 400 })
  }

  // Verify ownership
  const book = await db.query.books.findFirst({
    where: and(eq(books.id, bookId), eq(books.userId, userId)),
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
      type: binderItems.type,
      title: binderItems.title,
      order: binderItems.order,
      chapterContent: chapters.content,
    })
    .from(binderItems)
    .leftJoin(chapters, eq(chapters.binderItemId, binderItems.id))
    .where(eq(binderItems.bookId, bookId))
    .orderBy(asc(binderItems.order))

  // Only chapter-type items
  const chapterInputs = rows
    .filter(r => r.type === 'chapter')
    .map(r => ({ title: r.title ?? 'Untitled', content: r.chapterContent }))

  if (chapterInputs.length === 0) {
    return Response.json({ error: 'No chapters to export' }, { status: 400 })
  }

  const safeTitle = book.title.replace(/[^a-z0-9\s-]/gi, '').trim() || 'export'

  if (format === 'docx') {
    const url = new URL(request.url)
    const styleParam = url.searchParams.get('style') ?? 'manuscript'
    const validStyle: DocxStyle = styleParam === 'basic' ? 'basic' : 'manuscript'

    const buffer = await generateDocx(chapterInputs, validStyle, book.title, authorName)
    const filename = `${safeTitle}-${validStyle}.docx`

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }

  // EPUB — fetch ISBN from publishing metadata if available
  const meta = await db.query.bookPublishingMetadata.findFirst({
    where: eq(bookPublishingMetadata.bookId, bookId),
    columns: { isbn: true },
  }).catch(() => null)

  const buffer = await generateEpub(chapterInputs, book.title, authorName, meta?.isbn ?? null)
  const filename = `${safeTitle}.epub`

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/epub+zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
