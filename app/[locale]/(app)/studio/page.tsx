import { Plus } from 'lucide-react'
import { db } from '@/db'
import { bookTemplates } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getUserBooksAction, getStudioStatsAction } from '@/lib/actions/book.actions'
import { CreateBookModal } from './_components/create-book-modal'
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
    <main className="flex-1 p-6 lg:p-8 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl">Library</h1>
        <CreateBookModal locale={locale} templates={templates}>
          <button className="rounded-full px-5 py-2.5 text-sm inline-flex items-center gap-2 font-bold font-display bg-brand text-brand-ink shadow-[0_4px_16px_-8px_oklch(from_var(--brand)_l_c_h/0.55)] hover:bg-brand-hover transition-colors">
            <Plus size={16} strokeWidth={2.5} />
            New Book
          </button>
        </CreateBookModal>
      </div>

      <StudioHeader recentBook={recentBook} stats={stats} locale={locale} />

      <BookGrid books={books} locale={locale} />
    </main>
  )
}
