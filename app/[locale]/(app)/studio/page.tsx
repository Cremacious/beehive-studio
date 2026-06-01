import { db } from '@/db'
import { bookTemplates } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getUserBooksAction } from '@/lib/actions/book.actions'
import { getUserHivesView } from '@/lib/actions/hive.actions'
import { StudioEmptyState } from './_components/studio-empty-state'
import { DualHero } from './_components/dual-hero'
import { LibraryGrid } from './_components/library-grid'

export default async function StudioPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  const [templates, booksResult, hivesResult] = await Promise.all([
    db
      .select({ id: bookTemplates.id, name: bookTemplates.name, genre: bookTemplates.genre })
      .from(bookTemplates)
      .where(eq(bookTemplates.isSystemTemplate, true))
      .orderBy(bookTemplates.name),
    getUserBooksAction(),
    getUserHivesView(),
  ])

  const books = booksResult.success ? booksResult.data : []
  const hives = hivesResult.success ? hivesResult.data : []

  if (books.length === 0 && hives.length === 0) {
    return <StudioEmptyState locale={locale} templates={templates} />
  }

  // Most-recently-edited book — sort defensively so the hero is stable
  // regardless of getUserBooksAction's default ordering.
  const recentBook =
    books.length > 0
      ? [...books].sort(
          (a, b) =>
            new Date(b.lastEditedAt).getTime() - new Date(a.lastEditedAt).getTime(),
        )[0]
      : null

  // getUserHivesView already orders by most-recent activity desc, so the first
  // entry is the "active" hive.
  const activeHive = hives.length > 0 ? hives[0] : null

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

      <section style={{ marginBottom: '36px' }}>
        <DualHero book={recentBook} hive={activeHive} locale={locale} />
      </section>

      <h2
        className="font-comfortaa font-bold m-0"
        style={{
          color: 'var(--brand)',
          fontSize: '16px',
          letterSpacing: '-0.01em',
          marginBottom: '16px',
        }}
      >
        Your library
      </h2>

      <LibraryGrid books={books} hives={hives} locale={locale} />
    </main>
  )
}
