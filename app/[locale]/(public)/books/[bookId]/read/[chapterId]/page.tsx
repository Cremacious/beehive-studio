import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/db'
import { chapters, binderItems, books, userProfiles } from '@/db/schema'
import { and, eq, asc, inArray } from 'drizzle-orm'
import { buildBookSequence } from '@/lib/books/build-book-sequence'
import { tiptapToHtml } from '@/lib/export/tiptap-to-html'
import {
  TitlePageDisplay,
  CopyrightDisplay,
  DedicationDisplay,
  AcknowledgmentsDisplay,
  AboutAuthorDisplay,
  fbmSubtypeLabel,
} from '../../../_components/front-back-matter-display'
import type {
  TitlePageFields,
  CopyrightFields,
  DedicationFields,
  AcknowledgmentsFields,
  AboutAuthorFields,
} from '@/lib/front-back-matter/types'
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

  // Fetch every binder item that contributes to the reading sequence:
  // chapters + collections + front/back matter. FBM items carry their data
  // on binder_items.content; chapters on chapters.content.
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
  const allChapters = sequence.chapters
  const allInOrder = sequence.allInOrder

  // Resolve which entry in the full sequence we're rendering.
  const sequenceIndex = allInOrder.findIndex((e) =>
    e.kind === 'chapter' ? e.chapter.chapterId === chapterId : e.entry.chapterId === chapterId,
  )
  if (sequenceIndex === -1) notFound()
  const currentEntry = allInOrder[sequenceIndex]
  const isFbm = currentEntry.kind === 'fbm'

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
  // Chapter visibility gate only applies to chapter-kind entries. FBM items
  // bypass the FIRST_DRAFT / REVISED / FINAL ladder — they're metadata
  // pages, always visible when present.
  if (!isFbm && !isAuthor && !isChapterReaderVisible(chapter.status)) {
    return <LockedChapterPlaceholder bookId={bookId} locale={locale} />
  }

  // Resolve a binderItemId for the current entry (chapter rows have one via
  // their reading-order entry; FBM rows have one via their FbmEntry).
  const currentBinderItemId =
    currentEntry.kind === 'chapter'
      ? currentEntry.chapter.binderItemId
      : currentEntry.entry.binderItemId

  // Prev/Next walk the FULL sequence (FM -> chapters -> BM), so an FBM page's
  // Next can lead into the first chapter and the last chapter's Next can
  // lead into the acknowledgments.
  type NeighborInfo = {
    chapterId: string
    title: string
    collectionName: string | null
  } | null

  const collectionTitleById = new Map<string, string>()
  for (const r of binderRows) {
    if (r.type === 'part') collectionTitleById.set(r.id, r.title)
  }
  function neighborFor(index: number): NeighborInfo {
    if (index < 0 || index >= allInOrder.length) return null
    const e = allInOrder[index]
    if (e.kind === 'chapter') {
      const c = e.chapter
      const collectionName = c.collectionId
        ? collectionTitleById.get(c.collectionId) ?? null
        : null
      return { chapterId: c.chapterId, title: c.title, collectionName }
    }
    return { chapterId: e.entry.chapterId, title: e.entry.title, collectionName: null }
  }
  const prevInfo = neighborFor(sequenceIndex - 1)
  const nextInfo = neighborFor(sequenceIndex + 1)

  // For the chapter "number" label, only count chapter-kind entries (FBM
  // items shouldn't push Introduction from "Chapter 1" to "Chapter 2").
  const chapterReadingIndex =
    currentEntry.kind === 'chapter'
      ? allChapters.findIndex((c) => c.chapterId === chapterId)
      : -1
  const chapterNumber = chapterReadingIndex >= 0 ? chapterReadingIndex + 1 : 0
  const totalChapters = allChapters.length

  // Mark as read — chapter-kind only. FBM doesn't move the progress bar.
  if (userId && currentEntry.kind === 'chapter') {
    await markChapterReadAction(bookId, currentBinderItemId)
  }

  // Comments are CHAPTER ONLY — FBM pages (title page, copyright, etc.) skip
  // the fetch entirely + render no comments panel. Keeps the pre-fetch off
  // the FBM path and avoids spurious "Be the first to comment" UI on what
  // are effectively metadata pages.
  const wantsComments = currentEntry.kind === 'chapter'
  const [commentsResult, commentsCount, viewerProfileRow] = wantsComments
    ? await Promise.all([
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
    : [{ success: false } as const, 0, [] as { avatarUrl: string | null }[]]
  const initialComments =
    commentsResult.success ? commentsResult.data.comments : []
  const initialHasMore =
    commentsResult.success ? commentsResult.data.hasMore : false
  const viewerAvatarUrl =
    Array.isArray(viewerProfileRow) && viewerProfileRow[0]?.avatarUrl
      ? viewerProfileRow[0].avatarUrl
      : null

  // Chapter prose → htmlContent (TipTap → HTML, fed through the page's
  // dangerouslySetInnerHTML path). FBM → React node passed via
  // bodyOverride so the components render in-tree (Next 16 forbids
  // react-dom/server in app pages).
  let htmlContent = ''
  let bodyOverride: React.ReactNode = null
  if (currentEntry.kind === 'chapter') {
    htmlContent = chapter.content ? tiptapToHtml(chapter.content) : ''
  } else {
    const e = currentEntry.entry
    switch (e.subtype) {
      case 'title_page':
        bodyOverride = <TitlePageDisplay f={e.fields as Partial<TitlePageFields>} />
        break
      case 'copyright':
        bodyOverride = <CopyrightDisplay f={e.fields as Partial<CopyrightFields>} />
        break
      case 'dedication':
        bodyOverride = <DedicationDisplay f={e.fields as Partial<DedicationFields>} />
        break
      case 'acknowledgments':
        bodyOverride = (
          <AcknowledgmentsDisplay f={e.fields as Partial<AcknowledgmentsFields>} />
        )
        break
      case 'about_author':
        bodyOverride = <AboutAuthorDisplay f={e.fields as Partial<AboutAuthorFields>} />
        break
      default:
        // custom + legacy: render the chapters.content TipTap doc as prose
        htmlContent = e.content ? tiptapToHtml(e.content) : ''
    }
  }

  const showContributionByline =
    !isFbm && chapter.authorUserId !== null && chapter.authorUserId !== book.userId

  const renderTitle =
    currentEntry.kind === 'chapter'
      ? currentEntry.chapter.title
      : currentEntry.entry.title
  // For FBM, the "Chapter N of M" header becomes the subtype label
  // ("Title page", "Copyright", etc.). For chapters, pass the real index.
  const fbmSubtypeLabelStr =
    currentEntry.kind === 'fbm'
      ? fbmSubtypeLabel(currentEntry.entry.subtype, currentEntry.entry.type)
      : null

  return (
    <ReaderSurface
      htmlContent={htmlContent}
      bodyOverride={bodyOverride}
      chapterTitle={renderTitle}
      chapterNumber={chapterNumber}
      totalChapters={totalChapters}
      wordCount={!isFbm ? chapter.wordCount ?? 0 : 0}
      bookTitle={book.title}
      backHref={`/${locale}/books/${bookId}`}
      headerSubtitleOverride={fbmSubtypeLabelStr}
      prev={
        prevInfo
          ? {
              href: `/${locale}/books/${bookId}/read/${prevInfo.chapterId}`,
              title: prevInfo.title,
              collectionName: prevInfo.collectionName,
            }
          : null
      }
      next={
        nextInfo
          ? {
              href: `/${locale}/books/${bookId}/read/${nextInfo.chapterId}`,
              title: nextInfo.title,
              collectionName: nextInfo.collectionName,
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
        wantsComments ? (
          <ChapterCommentsPanel
            chapterId={chapterId}
            locale={locale}
            initialComments={initialComments}
            initialHasMore={initialHasMore}
            initialCount={commentsCount}
            isAuthenticated={!!userId}
            viewerAvatarUrl={viewerAvatarUrl}
          />
        ) : null
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
