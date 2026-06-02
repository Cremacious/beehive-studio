import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { db } from '@/db'
import { books, binderItems, chapters, bookComments, userProfiles } from '@/db/schema'
import { and, eq, asc, count } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { canReadBook } from '@/lib/books/can-read'
import { getSeriesNeighbors } from '@/lib/books/get-series-neighbors'
import { getPublicBookAction, getBookCommentsAction } from '@/lib/actions/discover.actions'
import { getReadingProgressAction } from '@/lib/actions/reading.actions'
import { getUserSocialStateAction } from '@/lib/actions/social.actions'
import { AccessDenied } from '../_components/access-denied'
import { ReaderPageShell } from '../_components/reader-page-shell'
import { CommentsPanel } from '../_components/comments-panel'
import { SeriesFooter } from '../../_components/series-footer'

type Props = { params: Promise<{ locale: string; bookId: string }> }

export default async function BookReaderPage({ params }: Props) {
  const { locale, bookId } = await params
  const headersList = await headers()
  const session = await auth.api.getSession({ headers: headersList })
  const userId = session?.user?.id ?? null

  const access = await canReadBook(bookId, userId)
  if (!access.ok) {
    if (access.reason === 'NOT_FOUND') notFound()
    return <AccessDenied reason={access.reason} locale={locale} />
  }

  const bookResult = await getPublicBookAction(bookId)
  if (!bookResult.success) notFound()
  const book = bookResult.data
  const isAuthor = userId === book.authorUserId

  // Supplement getPublicBookAction with fields it doesn't return.
  const [bookExtra] = await db
    .select({
      visibility: books.visibility,
      createdAt: books.createdAt,
      updatedAt: books.updatedAt,
    })
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1)
  if (!bookExtra) notFound()

  const [commentCountRow] = await db
    .select({ total: count() })
    .from(bookComments)
    .where(eq(bookComments.bookId, bookId))
  const commentCount = commentCountRow?.total ?? 0

  const chapterRows = await db
    .select({
      binderItemId: binderItems.id,
      chapterId: chapters.id,
      title: binderItems.title,
      order: binderItems.order,
      status: chapters.status,
      updatedAt: chapters.updatedAt,
    })
    .from(binderItems)
    .innerJoin(chapters, eq(chapters.binderItemId, binderItems.id))
    .where(and(eq(binderItems.bookId, bookId), eq(binderItems.type, 'chapter')))
    .orderBy(asc(binderItems.order))

  const [
    commentsResult,
    progressResult,
    socialResult,
    seriesNeighbors,
    viewerProfileRow,
  ] = await Promise.all([
    getBookCommentsAction(bookId, 1),
    userId ? getReadingProgressAction(bookId) : Promise.resolve(null),
    userId ? getUserSocialStateAction(bookId, book.authorUserId) : Promise.resolve(null),
    getSeriesNeighbors({
      currentBook: {
        id: book.id,
        userId: book.authorUserId,
        seriesName: book.seriesName,
        seriesNumber: book.seriesNumber,
      },
      viewerUserId: userId,
    }),
    userId
      ? db
          .select({ avatarUrl: userProfiles.avatarUrl })
          .from(userProfiles)
          .where(eq(userProfiles.userId, userId))
          .limit(1)
      : Promise.resolve(null),
  ])

  const comments = commentsResult.success ? commentsResult.data.comments : []
  const commentsHasMore = commentsResult.success ? commentsResult.data.hasMore : false
  const progress = progressResult?.success ? progressResult.data : null
  const social = socialResult?.success ? socialResult.data : null
  const viewerAvatarUrl = viewerProfileRow?.[0]?.avatarUrl ?? null

  const readerBasePath = `/${locale}/books/${bookId}`

  // Pick CTA targets — use the same reader-visible filter as <ChaptersPanel>.
  const isVisibleToViewer = (status: (typeof chapterRows)[number]['status']) =>
    isAuthor || status === 'REVISED' || status === 'FINAL'
  const visibleChapters = chapterRows.filter((c) => isVisibleToViewer(c.status))
  const lastChapter = progress?.lastChapterId
    ? visibleChapters.find((c) => c.chapterId === progress.lastChapterId)
    : null
  const firstVisible = visibleChapters[0] ?? null
  const startReadingHref = firstVisible ? `${readerBasePath}/read/${firstVisible.chapterId}` : null
  const continueReadingHref = lastChapter
    ? `${readerBasePath}/read/${lastChapter.chapterId}`
    : null

  // Share URL composed from inbound request headers so it works in dev + prod.
  const proto = headersList.get('x-forwarded-proto') ?? 'http'
  const host = headersList.get('host') ?? 'localhost:3000'
  const shareUrl = `${proto}://${host}${readerBasePath}`

  const visibility = (bookExtra.visibility ?? 'PUBLIC') as 'PUBLIC' | 'FRIENDS' | 'PRIVATE'

  return (
    <div className="min-h-screen bg-[#262728]">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-6">
          <ReaderPageShell
            hero={{
              book: { ...book, visibility, commentCount },
              locale,
              shareUrl,
              isAuthenticated: !!userId,
              startReadingHref,
              continueReadingHref,
              totalChapters: visibleChapters.length,
              firstPublishedAt: bookExtra.createdAt,
              lastUpdatedAt: bookExtra.updatedAt,
              initialLiked: social?.liked ?? false,
              initialBookmarked: social?.bookmarked ?? false,
              initialLikeCount: book.likeCount,
            }}
            chapters={{
              bookId,
              readerBasePath,
              chapters: chapterRows,
              initialReadSet: progress?.readChapterBinderItemIds ?? [],
              isAuthor,
              isAuthenticated: !!userId,
            }}
          >
            <CommentsPanel
              bookId={bookId}
              locale={locale}
              initialComments={comments}
              initialHasMore={commentsHasMore}
              initialCount={commentCount}
              isAuthenticated={!!userId}
              viewerAvatarUrl={viewerAvatarUrl}
            />
            <SeriesFooter neighbors={seriesNeighbors} locale={locale} />
          </ReaderPageShell>
        </div>
      </div>
    </div>
  )
}
