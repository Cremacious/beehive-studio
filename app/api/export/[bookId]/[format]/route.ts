import { auth } from '@/lib/auth'
import { db } from '@/db'
import { books, binderItems, chapters, userProfiles, bookPublishingMetadata } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { headers } from 'next/headers'
import { generateDocx, type DocxStyle, type ChapterInput } from '@/lib/export/docx'
import { generateEpub } from '@/lib/export/epub'
import {
  renderTitlePage,
  renderCopyright,
  renderDedication,
  renderAcknowledgments,
  renderAboutAuthor,
} from '@/lib/export/front-back-matter-templates'
import { scopedBooksForUser } from '@/lib/books/scoped'

type ExportRow = {
  id: string
  type: string
  title: string | null
  order: number
  chapterContent: unknown
  binderContent: unknown
}

function fbmRowToInput(row: ExportRow): ChapterInput | null {
  const c = row.binderContent as
    | { subtype?: string | null; fields?: Record<string, unknown> }
    | null

  // Legacy item (content === null) — use TipTap chapter content
  if (c === null || c === undefined) {
    return { title: row.title ?? '', content: row.chapterContent }
  }

  // Custom subtype (or no subtype) — use TipTap chapter content with the
  // title heading (consistent with regular chapter items).
  if (c.subtype === 'custom' || !c.subtype) {
    return { title: row.title ?? '', content: row.chapterContent }
  }

  // Specialized subtype — render via template, suppress title heading.
  // We keep row.title on the input so the epub nav still has a label.
  const fields = (c.fields ?? {}) as Record<string, unknown>
  const title = row.title ?? ''
  switch (c.subtype) {
    case 'title_page':
      return {
        title,
        content: null,
        htmlOverride: renderTitlePage(fields as Parameters<typeof renderTitlePage>[0]),
      }
    case 'copyright':
      return {
        title,
        content: null,
        htmlOverride: renderCopyright(fields as Parameters<typeof renderCopyright>[0]),
      }
    case 'dedication':
      return {
        title,
        content: null,
        htmlOverride: renderDedication(fields as Parameters<typeof renderDedication>[0]),
      }
    case 'acknowledgments':
      return {
        title,
        content: null,
        htmlOverride: renderAcknowledgments(
          fields as Parameters<typeof renderAcknowledgments>[0],
        ),
      }
    case 'about_author':
      return {
        title,
        content: null,
        htmlOverride: renderAboutAuthor(fields as Parameters<typeof renderAboutAuthor>[0]),
      }
    default:
      return null // unknown subtype — skip silently
  }
}

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
      type: binderItems.type,
      title: binderItems.title,
      order: binderItems.order,
      chapterContent: chapters.content,
      binderContent: binderItems.content,
    })
    .from(binderItems)
    .leftJoin(chapters, eq(chapters.binderItemId, binderItems.id))
    .where(eq(binderItems.bookId, bookId))
    .orderBy(asc(binderItems.order))

  const frontInputs = rows
    .filter(r => r.type === 'front_matter')
    .map(r => fbmRowToInput(r as ExportRow))
    .filter((x): x is ChapterInput => x !== null)

  const chapterInputs = rows
    .filter(r => r.type === 'chapter')
    .map(r => ({ title: r.title ?? 'Untitled', content: r.chapterContent }))

  const backInputs = rows
    .filter(r => r.type === 'back_matter')
    .map(r => fbmRowToInput(r as ExportRow))
    .filter((x): x is ChapterInput => x !== null)

  if (chapterInputs.length === 0) {
    return Response.json({ error: 'No chapters to export' }, { status: 400 })
  }

  const allInputs = [...frontInputs, ...chapterInputs, ...backInputs]

  const safeTitle = book.title.replace(/[^a-z0-9\s-]/gi, '').trim() || 'export'

  if (format === 'docx') {
    const url = new URL(request.url)
    const styleParam = url.searchParams.get('style') ?? 'manuscript'
    const validStyle: DocxStyle = styleParam === 'basic' ? 'basic' : 'manuscript'

    const buffer = await generateDocx(allInputs, validStyle, book.title, authorName)
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

  const buffer = await generateEpub(allInputs, book.title, authorName, meta?.isbn ?? null)
  const filename = `${safeTitle}.epub`

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/epub+zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
