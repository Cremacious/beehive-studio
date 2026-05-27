import { db } from '@/db'
import { bookTemplates } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getUserBooksAction, getStudioStatsAction } from '@/lib/actions/book.actions'
import { StudioEmptyState } from './_components/studio-empty-state'
import { StudioHeader } from './_components/studio-header'
import { BookGrid } from './_components/book-grid'

export default async function StudioPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  const [templates, booksResult, statsResult] = await Promise.all([
    db
      .select({ id: bookTemplates.id, name: bookTemplates.name, genre: bookTemplates.genre })
      .from(bookTemplates)
      .where(eq(bookTemplates.isSystemTemplate, true))
      .orderBy(bookTemplates.name),
    getUserBooksAction(),
    getStudioStatsAction(),
  ])

  const books = booksResult.success ? booksResult.data : []
  const stats = statsResult.success
    ? statsResult.data
    : { totalWords: 0, booksInProgress: 0, wordsThisWeek: 0, chaptersPublished: 0 }

  if (books.length === 0) {
    return <StudioEmptyState locale={locale} templates={templates} />
  }

  // Most-recently-edited book — sort defensively so the hero is stable
  // regardless of getUserBooksAction's default ordering.
  const recentBook = [...books].sort(
    (a, b) => new Date(b.lastEditedAt).getTime() - new Date(a.lastEditedAt).getTime(),
  )[0]

  return (
    <main
      className="relative z-[1]"
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '0 32px 96px',
      }}
    >
      <div style={{ height: '40px' }} />

      <StudioHeader recentBook={recentBook} stats={stats} locale={locale} />

      <BookGrid books={books} locale={locale} />
    </main>
  )
}
