import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { books, chapters } from '@/db/schema'
import { extractWordCount } from '@/lib/tiptap-utils'
import { beaconSaveSchema } from './schema'

// Fire-and-forget endpoint called via navigator.sendBeacon during beforeunload.
// Mirrors saveChapterAction's authz exactly: session check + chapter ownership
// via the parent book's userId. Skips snapshot creation — that path is handled
// by the in-session save flow.
export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return new Response(null, { status: 401 })
    }
    const userId = session.user.id

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return new Response(null, { status: 400 })
    }

    const parsed = beaconSaveSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(null, { status: 400 })
    }
    const { chapterId, content } = parsed.data

    const chapter = await db.query.chapters.findFirst({
      where: eq(chapters.id, chapterId),
      with: { book: { columns: { userId: true } } },
    })
    if (!chapter || chapter.book.userId !== userId) {
      return new Response(null, { status: 404 })
    }

    const wordCount = extractWordCount(content)

    await db.transaction(async (tx) => {
      await tx
        .update(chapters)
        .set({ content, wordCount, updatedAt: new Date() })
        .where(eq(chapters.id, chapterId))
      await tx
        .update(books)
        .set({ updatedAt: new Date() })
        .where(eq(books.id, chapter.bookId))
    })

    return new Response(null, { status: 204 })
  } catch {
    return new Response(null, { status: 500 })
  }
}
