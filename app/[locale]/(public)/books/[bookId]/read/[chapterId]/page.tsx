import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/db'
import { chapters, binderItems, books, userProfiles } from '@/db/schema'
import { and, eq, asc } from 'drizzle-orm'
import { tiptapToHtml } from '@/lib/export/tiptap-to-html'
import { markChapterReadAction } from '@/lib/actions/reading.actions'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { canReadBook } from '@/lib/books/can-read'
import { isChapterReaderVisible } from '@/lib/books/is-chapter-reader-visible'
import { AccessDenied } from '../../../_components/access-denied'
import { Clock } from 'lucide-react'
import { ReaderSurface } from './_components/reader-surface'

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

  // Fetch book + book-owner profile for title display + byline
  const [book] = await db
    .select({
      id: books.id,
      title: books.title,
      userId: books.userId,
      bookAuthorUsername: userProfiles.username,
      bookAuthorDisplayName: userProfiles.displayName,
    })
    .from(books)
    .leftJoin(userProfiles, eq(userProfiles.userId, books.userId))
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

  // Fetch chapter content + contributing-author profile (if set)
  const [chapter] = await db
    .select({
      content: chapters.content,
      wordCount: chapters.wordCount,
      status: chapters.status,
      authorUserId: chapters.authorUserId,
      chapterAuthorUsername: userProfiles.username,
      chapterAuthorDisplayName: userProfiles.displayName,
    })
    .from(chapters)
    .leftJoin(userProfiles, eq(userProfiles.userId, chapters.authorUserId))
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

  // Mark chapter as read for authenticated users
  if (userId) {
    await markChapterReadAction(bookId, current.binderItemId)
  }

  const htmlContent = chapter.content ? tiptapToHtml(chapter.content) : ''

  const showContributionByline =
    chapter.authorUserId !== null && chapter.authorUserId !== book.userId

  return (
    <ReaderSurface
      htmlContent={htmlContent}
      chapterTitle={current.title}
      chapterNumber={chapterNumber}
      totalChapters={totalChapters}
      wordCount={chapter.wordCount ?? 0}
      bookTitle={book.title}
      backHref={`/${locale}/books/${bookId}`}
      prev={
        prevChapter
          ? {
              href: `/${locale}/books/${bookId}/read/${prevChapter.chapterId}`,
              title: prevChapter.title,
            }
          : null
      }
      next={
        nextChapter
          ? {
              href: `/${locale}/books/${bookId}/read/${nextChapter.chapterId}`,
              title: nextChapter.title,
            }
          : null
      }
      contributionByline={
        showContributionByline
          ? {
              chapterAuthor: {
                username: chapter.chapterAuthorUsername,
                displayName: chapter.chapterAuthorDisplayName,
              },
              bookAuthor: {
                username: book.bookAuthorUsername,
                displayName: book.bookAuthorDisplayName,
              },
              bookTitle: book.title,
              locale,
            }
          : null
      }
    />
  )
}

function LockedChapterPlaceholder({ bookId, locale }: { bookId: string; locale: string }) {
  return (
    <main className="min-h-screen bg-[#232425] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-[var(--canvas-dark-150)] border border-[var(--canvas-dark-350)] flex items-center justify-center mb-5">
          <Clock className="w-6 h-6 text-[rgba(255,255,255,0.7)]" />
        </div>
        <h1 className="text-white text-[20px] font-semibold mb-2">
          This chapter is still being drafted
        </h1>
        <p className="text-[rgba(255,255,255,0.7)] text-[14px] mb-6">
          The author hasn&apos;t published this chapter yet. Check back soon.
        </p>
        <Link
          href={`/${locale}/books/${bookId}`}
          className="inline-block px-5 py-2 bg-[var(--brand)] text-[var(--brand-ink)] font-semibold rounded-md text-[14px] hover:bg-[var(--brand-hover)] transition-colors"
        >
          Back to chapters
        </Link>
      </div>
    </main>
  )
}
