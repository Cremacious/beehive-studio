import { notFound } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { db } from '@/db'
import { binderItems, chapters } from '@/db/schema'
import { and, eq, asc } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { canReadBook } from '@/lib/books/can-read'
import { getPublicBookAction, getBookCommentsAction } from '@/lib/actions/discover.actions'
import { getReadingProgressAction } from '@/lib/actions/reading.actions'
import { getUserSocialStateAction } from '@/lib/actions/social.actions'
import { ChapterList } from '../../_components/chapter-list'
import { CommentsPanel } from '../../_components/comments-panel'
import { SocialActions } from '../../_components/social-actions'
import { AccessDenied } from '../_components/access-denied'

type Props = { params: Promise<{ locale: string; bookId: string }> }

export default async function BookReaderPage({ params }: Props) {
  const { locale, bookId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
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

  const chapterRows = await db
    .select({
      binderItemId: binderItems.id,
      chapterId: chapters.id,
      title: binderItems.title,
      wordCount: chapters.wordCount,
      order: binderItems.order,
    })
    .from(binderItems)
    .innerJoin(chapters, eq(chapters.binderItemId, binderItems.id))
    .where(and(eq(binderItems.bookId, bookId), eq(binderItems.type, 'chapter')))
    .orderBy(asc(binderItems.order))

  const [commentsResult, progressResult, socialResult] = await Promise.all([
    getBookCommentsAction(bookId, 1),
    userId ? getReadingProgressAction(bookId) : Promise.resolve(null),
    userId ? getUserSocialStateAction(bookId, book.authorUserId) : Promise.resolve(null),
  ])

  const comments = commentsResult.success ? commentsResult.data.comments : []
  const commentsHasMore = commentsResult.success ? commentsResult.data.hasMore : false
  const progress = progressResult?.success ? progressResult.data : null
  const social = socialResult?.success ? socialResult.data : null

  const progressPercent = progress && chapterRows.length > 0
    ? Math.round((progress.readChapterBinderItemIds.length / chapterRows.length) * 100)
    : 0

  const lastReadChapter = progress?.lastChapterId
    ? chapterRows.find(ch => ch.chapterId === progress.lastChapterId)
    : null

  const normalizedChapterRows = chapterRows.map(ch => ({ ...ch, wordCount: ch.wordCount ?? 0 }))
  const readerBasePath = `/${locale}/books/${bookId}`
  const backHref = isAuthor ? `/${locale}/studio/${bookId}` : `/${locale}/discover`
  const backLabel = isAuthor ? '← Back to editor' : '← Discover'

  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="bg-[#1a1a1a] border-b border-[#2a2a2a] px-6 py-3 flex items-center gap-3">
        <Link href={backHref} className="text-[#888] text-[13px] hover:text-white transition-colors">
          {backLabel}
        </Link>
      </div>

      <div className="px-6 py-7 grid gap-6 border-b border-[#2a2a2a]" style={{ gridTemplateColumns: '160px 1fr' }}>
        <div className="aspect-[2/3] bg-gradient-to-br from-[#1e1e1e] to-[#2a2a2a] rounded-md relative flex items-end p-2.5 shrink-0">
          {book.coverUrl && (
            <img src={book.coverUrl} alt={book.title} className="absolute inset-0 w-full h-full object-cover rounded-md" />
          )}
          {book.genre && (
            <span className="relative z-10 text-[11px] text-[#aaa] bg-black/60 px-2 py-0.5 rounded">{book.genre}</span>
          )}
        </div>

        <div className="flex flex-col justify-between">
          <div>
            <h1 className="text-white text-[26px] font-semibold leading-tight mb-1">{book.title}</h1>
            <div className="flex items-center gap-2.5 mb-3.5">
              <div className="w-6 h-6 rounded-full bg-[#2a2a2a] shrink-0 overflow-hidden flex items-center justify-center text-[11px]">
                {book.authorAvatarUrl ? (
                  <img src={book.authorAvatarUrl} alt="" className="w-full h-full object-cover" />
                ) : '✍'}
              </div>
              <span className="text-[#aaa] text-[13px]">
                by <span className="text-[#FFC300]">{book.authorDisplayName ?? book.authorUsername ?? 'Unknown'}</span>
              </span>
            </div>

            {book.tags && book.tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-3.5">
                {book.tags.map(tag => (
                  <span key={tag} className="px-2.5 py-0.5 bg-[#2a2a2a] text-[#aaa] rounded-full text-[11px]">{tag}</span>
                ))}
              </div>
            )}

            <div className="flex gap-5 mb-4">
              {[
                { label: 'Words', value: book.wordCount >= 1000 ? `${Math.round(book.wordCount / 1000)}k` : book.wordCount },
                { label: 'Chapters', value: book.chapterCount },
                { label: 'Likes', value: book.likeCount },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[#555] text-[10px] uppercase tracking-wide">{label}</p>
                  <p className="text-[#aaa] text-[14px] font-semibold mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {book.synopsis && <p className="text-[#888] text-[13px] leading-relaxed max-w-xl">{book.synopsis}</p>}
          </div>

          <div className="mt-4 flex items-center gap-2.5 flex-wrap">
            {normalizedChapterRows[0] && (
              <Link
                href={`${readerBasePath}/read/${lastReadChapter?.chapterId ?? normalizedChapterRows[0].chapterId}`}
                className="px-6 py-2.5 bg-[#FFC300] text-black font-bold rounded-md text-[14px] hover:bg-yellow-400 transition-colors"
              >
                {lastReadChapter ? 'Continue Reading →' : 'Start Reading →'}
              </Link>
            )}
            <SocialActions
              bookId={bookId}
              authorUserId={book.authorUserId}
              locale={locale}
              initialLiked={social?.liked ?? false}
              initialBookmarked={social?.bookmarked ?? false}
              initialFollowing={social?.following ?? false}
              initialLikeCount={book.likeCount}
              isAuthenticated={!!userId}
            />
          </div>
        </div>
      </div>

      {progress?.lastChapterId && (
        <div className="px-6 py-3 bg-[#181818] border-b border-[#2a2a2a] flex items-center gap-3">
          <span className="text-[#888] text-[12px] shrink-0">Your progress</span>
          <div className="flex-1 h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div className="h-full bg-[#FFC300] rounded-full" style={{ width: `${progressPercent}%` }} />
          </div>
          {lastReadChapter && (
            <Link
              href={`${readerBasePath}/read/${lastReadChapter.chapterId}`}
              className="text-[#888] text-[12px] shrink-0 hover:text-white transition-colors"
            >
              Ch {normalizedChapterRows.findIndex(c => c.chapterId === lastReadChapter.chapterId) + 1} of {normalizedChapterRows.length} · Continue →
            </Link>
          )}
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: '1fr 340px' }}>
        <div className="p-6 border-r border-[#2a2a2a]">
          <ChapterList
            bookId={bookId}
            locale={locale}
            readerBasePath={readerBasePath}
            chapters={normalizedChapterRows}
            currentChapterId={progress?.lastChapterId ?? null}
            readChapterBinderItemIds={progress?.readChapterBinderItemIds ?? []}
          />
        </div>
        <div className="p-5">
          <CommentsPanel
            bookId={bookId}
            locale={locale}
            initialComments={comments}
            initialHasMore={commentsHasMore}
            isAuthenticated={!!userId}
          />
        </div>
      </div>
    </div>
  )
}
