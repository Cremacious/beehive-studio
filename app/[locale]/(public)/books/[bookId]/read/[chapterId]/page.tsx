import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/db'
import { chapters, binderItems, books, userProfiles } from '@/db/schema'
import { and, eq, asc, inArray } from 'drizzle-orm'
import { buildReadingOrder } from '@/lib/books/build-reading-order'
import { tiptapToHtml } from '@/lib/export/tiptap-to-html'
import { markChapterReadAction } from '@/lib/actions/reading.actions'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { canReadBook } from '@/lib/books/can-read'
import { isChapterReaderVisible } from '@/lib/books/is-chapter-reader-visible'
import { AccessDenied } from '../../../_components/access-denied'
import { Clock } from 'lucide-react'
import { ReaderSurface } from './_components/reader-surface'
import { ChapterCommentsPanel } from './_components/chapter-comments-panel'
import {
  getChapterCommentsAction,
  getChapterCommentsCountAction,
} from '@/lib/actions/chapter-comments.actions'

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

  // Fetch all chapter + collection binder items and resolve the global
  // reading order so Prev/Next walk nested chapters in true sequence.
  // (binder_items.order is parent-scoped, not global.)
  const binderRows = await db
    .select({
      id: binderItems.id,
      parentId: binderItems.parentId,
      type: binderItems.type,
      order: binderItems.order,
      title: binderItems.title,
      chapterId: chapters.id,
      status: chapters.status,
      updatedAt: chapters.updatedAt,
    })
    .from(binderItems)
    .leftJoin(chapters, eq(chapters.binderItemId, binderItems.id))
    .where(
      and(
        eq(binderItems.bookId, bookId),
        inArray(binderItems.type, ['chapter', 'part']),
      ),
    )
    .orderBy(asc(binderItems.order))

  const { flat: allChapters } = buildReadingOrder(
    binderRows.map((r) => ({
      id: r.id,
      parentId: r.parentId,
      type: r.type as 'chapter' | 'part',
      order: r.order,
      title: r.title,
      chapterId: r.chapterId,
      status: r.status,
      updatedAt: r.updatedAt,
    })),
  )

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

  // Map collection (part) ids to their titles so the prev/next nav cards
  // can show "Knights of Varrock" above "Part Two" when navigating into a
  // chapter that lives inside a collection.
  const collectionTitleById = new Map<string, string>()
  for (const r of binderRows) {
    if (r.type === 'part') collectionTitleById.set(r.id, r.title)
  }
  const prevCollectionName = prevChapter?.collectionId
    ? collectionTitleById.get(prevChapter.collectionId) ?? null
    : null
  const nextCollectionName = nextChapter?.collectionId
    ? collectionTitleById.get(nextChapter.collectionId) ?? null
    : null
  const current = allChapters[currentIndex]
  const chapterNumber = currentIndex + 1
  const totalChapters = allChapters.length

  // Mark chapter as read for authenticated users
  if (userId) {
    await markChapterReadAction(bookId, current.binderItemId)
  }

  // Pre-fetch chapter comments (page 1) + total + viewer avatar in parallel.
  const [commentsResult, commentsCount, viewerProfileRow] = await Promise.all([
    getChapterCommentsAction(chapterId, 1),
    getChapterCommentsCountAction(chapterId),
    userId
      ? db
          .select({ avatarUrl: userProfiles.avatarUrl })
          .from(userProfiles)
          .where(eq(userProfiles.userId, userId))
          .limit(1)
      : Promise.resolve([]),
  ])
  const initialComments = commentsResult.success ? commentsResult.data.comments : []
  const initialHasMore = commentsResult.success ? commentsResult.data.hasMore : false
  const viewerAvatarUrl =
    Array.isArray(viewerProfileRow) && viewerProfileRow[0]?.avatarUrl
      ? viewerProfileRow[0].avatarUrl
      : null

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
              collectionName: prevCollectionName,
            }
          : null
      }
      next={
        nextChapter
          ? {
              href: `/${locale}/books/${bookId}/read/${nextChapter.chapterId}`,
              title: nextChapter.title,
              collectionName: nextCollectionName,
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
      commentsSlot={
        <ChapterCommentsPanel
          chapterId={chapterId}
          locale={locale}
          initialComments={initialComments}
          initialHasMore={initialHasMore}
          initialCount={commentsCount}
          isAuthenticated={!!userId}
          viewerAvatarUrl={viewerAvatarUrl}
        />
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
