import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { db } from '@/db'
import { books, binderItems, chapters, bookComments, userProfiles } from '@/db/schema'
import { and, eq, asc, count, inArray } from 'drizzle-orm'
import { buildBookSequence, isFbmEntryEmpty } from '@/lib/books/build-book-sequence'
import { auth } from '@/lib/auth'
import { canReadBook } from '@/lib/books/can-read'
import { getSeriesNeighbors } from '@/lib/books/get-series-neighbors'
import {
  getPublicBookAction,
  getBookCommentsAction,
  getMoreByAuthorAction,
} from '@/lib/actions/discover.actions'
import { getReadingProgressAction } from '@/lib/actions/reading.actions'
import { getUserSocialStateAction } from '@/lib/actions/social.actions'
import { AccessDenied } from '../_components/access-denied'
import { ReaderPageShell } from '../_components/reader-page-shell'
import { CommentsPanel } from '../_components/comments-panel'
import { SeriesFooter } from '../../_components/series-footer'
import { JsonLd } from '@/components/seo/json-ld'
import {
  SITE_NAME,
  absoluteUrl,
  localeAlternates,
  toMetaDescription,
} from '@/lib/seo/site'

type Props = { params: Promise<{ locale: string; bookId: string }> }

// ─── SEO (issue #52) ──────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, bookId } = await params

  // Gate on anonymous access: a crawler (or a social-card scraper) is never
  // signed in, so a book is only indexable / metadata-bearing when it is
  // readable with no viewer. PRIVATE / FRIENDS books therefore noindex and
  // never leak their title or synopsis.
  const access = await canReadBook(bookId, null)
  if (!access.ok) {
    return { title: SITE_NAME, robots: { index: false, follow: false } }
  }

  const [row] = await db
    .select({
      title: books.title,
      synopsis: books.synopsis,
      coverUrl: books.coverUrl,
      genre: books.genre,
      tags: books.tags,
      discoverable: books.discoverable,
      updatedAt: books.updatedAt,
      authorUsername: userProfiles.username,
      authorDisplayName: userProfiles.displayName,
    })
    .from(books)
    .leftJoin(userProfiles, eq(userProfiles.userId, books.userId))
    .where(eq(books.id, bookId))
    .limit(1)

  if (!row) return { title: SITE_NAME, robots: { index: false, follow: false } }

  const author = row.authorDisplayName ?? (row.authorUsername ? `@${row.authorUsername}` : null)
  const title = author ? `${row.title} by ${author}` : row.title
  const description =
    toMetaDescription(row.synopsis) ??
    `Read ${row.title}${author ? ` by ${author}` : ''} on ${SITE_NAME}.`
  const path = `/books/${bookId}`
  const ogImage = row.coverUrl ?? undefined

  return {
    title,
    description,
    keywords: [row.genre, ...(row.tags ?? [])].filter(Boolean) as string[],
    alternates: localeAlternates(locale, path),
    // PUBLIC-but-not-discoverable books stay readable by link (and unfurl with
    // a rich preview when their author shares them) but are not indexed.
    robots: row.discoverable ? undefined : { index: false, follow: true },
    openGraph: {
      type: 'book',
      title,
      description,
      url: absoluteUrl(`/${locale}${path}`),
      images: ogImage ? [{ url: ogImage, alt: row.title }] : undefined,
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  }
}

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

  // Pull all chapter / collection / front_matter / back_matter binder items
  // for this book in one query, then walk the tree to build the full reading
  // sequence (front matter -> chapters in collection-aware reading order ->
  // back matter). FBM items carry their content on binder_items.content
  // (subtype + structured fields).
  const binderRows = await db
    .select({
      id: binderItems.id,
      parentId: binderItems.parentId,
      type: binderItems.type,
      order: binderItems.order,
      title: binderItems.title,
      binderContent: binderItems.content,
      chapterId: chapters.id,
      chapterContent: chapters.content,
      status: chapters.status,
      updatedAt: chapters.updatedAt,
    })
    .from(binderItems)
    .leftJoin(chapters, eq(chapters.binderItemId, binderItems.id))
    .where(
      and(
        eq(binderItems.bookId, bookId),
        inArray(binderItems.type, ['chapter', 'part', 'front_matter', 'back_matter']),
      ),
    )
    .orderBy(asc(binderItems.order))

  const sequence = buildBookSequence(
    binderRows.map((r) => ({
      id: r.id,
      parentId: r.parentId,
      type: r.type as 'chapter' | 'part' | 'front_matter' | 'back_matter',
      order: r.order,
      title: r.title,
      chapterId: r.chapterId,
      status: r.status,
      updatedAt: r.updatedAt,
      binderContent: r.binderContent,
      chapterContent: r.chapterContent,
    })),
  )
  const chapterRows = sequence.chapters

  // Filter FBM lists for non-authors: skip items with no content so the
  // reader doesn't see empty links. (Authors always see their own items.)
  const visibleFrontMatter = isAuthor
    ? sequence.frontMatter
    : sequence.frontMatter.filter((e) => !isFbmEntryEmpty(e, e.content))
  const visibleBackMatter = isAuthor
    ? sequence.backMatter
    : sequence.backMatter.filter((e) => !isFbmEntryEmpty(e, e.content))

  const [
    commentsResult,
    progressResult,
    socialResult,
    seriesNeighbors,
    viewerProfileRow,
    moreByAuthorResult,
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
    getMoreByAuthorAction(book.authorUserId, bookId),
  ])

  const comments = commentsResult.success ? commentsResult.data.comments : []
  const commentsHasMore = commentsResult.success ? commentsResult.data.hasMore : false
  const progress = progressResult?.success ? progressResult.data : null
  const social = socialResult?.success ? socialResult.data : null
  const viewerAvatarUrl = viewerProfileRow?.[0]?.avatarUrl ?? null
  const moreByAuthor = moreByAuthorResult.success ? moreByAuthorResult.data : null

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

  // Structured data only for genuinely public books (issue #52). Never emit
  // JSON-LD describing a FRIENDS / PRIVATE book even when the author or a
  // friend is the one viewing it.
  const authorName =
    book.authorDisplayName ?? (book.authorUsername ? `@${book.authorUsername}` : 'Unknown')
  const bookJsonLd =
    visibility === 'PUBLIC'
      ? {
          '@context': 'https://schema.org',
          '@type': 'Book',
          name: book.title,
          url: shareUrl,
          inLanguage: 'en',
          ...(book.synopsis ? { description: book.synopsis } : {}),
          ...(book.coverUrl ? { image: book.coverUrl } : {}),
          ...(book.genre ? { genre: book.genre } : {}),
          datePublished: bookExtra.createdAt.toISOString(),
          dateModified: bookExtra.updatedAt.toISOString(),
          author: {
            '@type': 'Person',
            name: authorName,
            ...(book.authorUsername
              ? { url: absoluteUrl(`/${locale}/u/${book.authorUsername}`) }
              : {}),
          },
          publisher: { '@type': 'Organization', name: SITE_NAME },
        }
      : null
  const breadcrumbJsonLd =
    visibility === 'PUBLIC'
      ? {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: SITE_NAME, item: absoluteUrl(`/${locale}`) },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Discover',
              item: absoluteUrl(`/${locale}/discover`),
            },
            { '@type': 'ListItem', position: 3, name: book.title, item: shareUrl },
          ],
        }
      : null

  return (
    <div className="relative min-h-screen bg-[#262728]">
      {bookJsonLd && <JsonLd data={bookJsonLd} />}
      {breadcrumbJsonLd && <JsonLd data={breadcrumbJsonLd} />}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, oklch(1 0 0 / 0.012) 1px, transparent 0)',
          backgroundSize: '26px 26px',
        }}
      />
      <div className="relative z-10 page-x tier-reader py-10">
        <div className="flex flex-col gap-7">
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
              tree: sequence.chaptersTree,
              frontMatter: visibleFrontMatter.map((e) => ({
                chapterId: e.chapterId,
                title: e.title,
                subtype: e.subtype,
              })),
              backMatter: visibleBackMatter.map((e) => ({
                chapterId: e.chapterId,
                title: e.title,
                subtype: e.subtype,
              })),
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
            <SeriesFooter
              neighbors={seriesNeighbors}
              locale={locale}
              moreByAuthor={moreByAuthor}
            />
          </ReaderPageShell>
        </div>
      </div>
    </div>
  )
}
