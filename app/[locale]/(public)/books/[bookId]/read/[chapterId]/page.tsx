import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/db'
import { chapters, binderItems, books } from '@/db/schema'
import { and, eq, asc } from 'drizzle-orm'
import { tiptapToHtml } from '@/lib/export/tiptap-to-html'
import { markChapterReadAction } from '@/lib/actions/reading.actions'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { canReadBook } from '@/lib/books/can-read'
import { isChapterReaderVisible } from '@/lib/books/is-chapter-reader-visible'
import { AccessDenied } from '../../../_components/access-denied'
import { Clock } from 'lucide-react'

type Props = { params: Promise<{ locale: string; bookId: string; chapterId: string }> }

export default async function ChapterReaderPage({ params }: Props) {
  const { locale, bookId, chapterId } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session?.user?.id ?? null

  const access = await canReadBook(bookId, userId)
  if (!access.ok) {
    if (access.reason === 'NOT_FOUND') notFound()
    return <AccessDenied reason={access.reason} locale={locale} />
  }

  // Fetch book for title display
  const [book] = await db
    .select({ id: books.id, title: books.title, userId: books.userId })
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1)

  if (!book) notFound()

  // Fetch all chapter binder items for navigation
  const allChapters = await db
    .select({
      binderItemId: binderItems.id,
      chapterId: chapters.id,
      title: binderItems.title,
      order: binderItems.order,
    })
    .from(binderItems)
    .innerJoin(chapters, eq(chapters.binderItemId, binderItems.id))
    .where(and(eq(binderItems.bookId, bookId), eq(binderItems.type, 'chapter')))
    .orderBy(asc(binderItems.order))

  const currentIndex = allChapters.findIndex(ch => ch.chapterId === chapterId)
  if (currentIndex === -1) notFound()

  // Fetch chapter content
  const [chapter] = await db
    .select({ content: chapters.content, wordCount: chapters.wordCount, status: chapters.status })
    .from(chapters)
    .where(eq(chapters.id, chapterId))
    .limit(1)

  if (!chapter) notFound()

  const isAuthor = userId === book.userId
  if (!isAuthor && !isChapterReaderVisible(chapter.status)) {
    return <LockedChapterPlaceholder bookId={bookId} locale={locale} />
  }

  const prevChapter = currentIndex > 0 ? allChapters[currentIndex - 1] : null
  const nextChapter = currentIndex < allChapters.length - 1 ? allChapters[currentIndex + 1] : null
  const current = allChapters[currentIndex]
  const chapterNumber = currentIndex + 1
  const totalChapters = allChapters.length
  const progressPercent = Math.round((chapterNumber / totalChapters) * 100)

  // Mark chapter as read for authenticated users
  if (userId) {
    await markChapterReadAction(bookId, chapterId)
  }

  const htmlContent = chapter.content ? tiptapToHtml(chapter.content) : ''

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* Top bar */}
      <div className="bg-[#1a1a1a] border-b border-[#2a2a2a] px-6 py-2.5 flex items-center justify-between sticky top-0 z-10">
        <Link
          href={`/${locale}/books/${bookId}`}
          className="text-[#888] text-[13px] hover:text-white transition-colors"
        >
          ← {book.title}
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-[#555] text-[12px]">Ch {chapterNumber} of {totalChapters}</span>
          <div className="w-20 h-0.5 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div className="h-full bg-[#FFC300] rounded-full" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        <Link
          href={`/${locale}/books/${bookId}`}
          className="px-3 py-1 bg-transparent border border-[#2a2a2a] text-[#888] rounded text-[12px] hover:text-white transition-colors"
        >
          ♥ Like book
        </Link>
      </div>

      {/* Chapter content */}
      <div className="max-w-[640px] mx-auto px-6 py-12">
        <p className="text-[#555] text-[12px] uppercase tracking-widest mb-1.5">Chapter {chapterNumber}</p>
        <h2 className="text-white text-[24px] font-semibold mb-9">{current.title}</h2>
        <div
          className="prose-chapter text-[#ccc] text-[16px] leading-[1.9]"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>

      {/* Footer nav */}
      <div className="border-t border-[#2a2a2a] px-6 py-4 flex items-center justify-between bg-[#1a1a1a]">
        {prevChapter ? (
          <Link
            href={`/${locale}/books/${bookId}/read/${prevChapter.chapterId}`}
            className="px-4 py-2 bg-transparent border border-[#2a2a2a] text-[#888] rounded-md text-[13px] hover:text-white transition-colors"
          >
            ← {prevChapter.title}
          </Link>
        ) : (
          <Link
            href={`/${locale}/books/${bookId}`}
            className="px-4 py-2 bg-transparent border border-[#2a2a2a] text-[#888] rounded-md text-[13px] hover:text-white transition-colors"
          >
            ← Back to book
          </Link>
        )}
        <div className="text-center">
          <p className="text-[#555] text-[11px]">
            {(chapter.wordCount ?? 0).toLocaleString()} words
          </p>
        </div>
        {nextChapter ? (
          <Link
            href={`/${locale}/books/${bookId}/read/${nextChapter.chapterId}`}
            className="px-4 py-2 bg-[#FFC300] text-black font-semibold rounded-md text-[13px] hover:bg-yellow-400 transition-colors"
          >
            {nextChapter.title} →
          </Link>
        ) : (
          <Link
            href={`/${locale}/books/${bookId}`}
            className="px-4 py-2 bg-[#2a2a2a] text-[#aaa] rounded-md text-[13px] hover:text-white transition-colors"
          >
            Finished ✓ Back to book
          </Link>
        )}
      </div>
    </div>
  )
}

function LockedChapterPlaceholder({ bookId, locale }: { bookId: string; locale: string }) {
  return (
    <main className="min-h-screen bg-[#141414] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-[#1f1f1f] border border-[#2a2a2a] flex items-center justify-center mb-5">
          <Clock className="w-6 h-6 text-[#888]" />
        </div>
        <h1 className="text-white text-[20px] font-semibold mb-2">
          This chapter is still being drafted
        </h1>
        <p className="text-[#888] text-[14px] mb-6">
          The author hasn&apos;t published this chapter yet. Check back soon.
        </p>
        <Link
          href={`/${locale}/books/${bookId}`}
          className="inline-block px-5 py-2 bg-[#FFC300] text-black font-semibold rounded-md text-[14px] hover:bg-yellow-400 transition-colors"
        >
          Back to chapters
        </Link>
      </div>
    </main>
  )
}
