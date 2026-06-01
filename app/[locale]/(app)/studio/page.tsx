import { db } from '@/db'
import { bookTemplates } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getUserBooksAction } from '@/lib/actions/book.actions'
import { getUserHivesView } from '@/lib/actions/hive.actions'
import { StudioEmptyState } from './_components/studio-empty-state'
import { ContinueWritingHero } from './_components/continue-writing-hero'
import { HiveRail } from './_components/hive-rail'
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

  // Most-recently-edited book → hero. Defensive sort regardless of action order.
  const recentBook =
    books.length > 0
      ? [...books].sort(
          (a, b) =>
            new Date(b.lastEditedAt).getTime() - new Date(a.lastEditedAt).getTime(),
        )[0]
      : null

  return (
    <main
      className="relative z-[1] mx-auto"
      style={{ maxWidth: '1680px', padding: '8px 16px 48px' }}
    >
      {/* Page-content shell — all studio content lives inside this dark-gray
          rounded wrapper so the cards float on a clearly distinct surface
          (vs. the outer #141414 layout backdrop). */}
      <div
        style={{
          background: '#1E1E1E',
          borderRadius: 'var(--r-card)',
          padding: '24px',
          boxShadow: '0 1px 0 oklch(1 0 0 / 0.04) inset, 0 8px 24px oklch(0 0 0 / 0.25)',
          border: 'var(--br-card)',
        }}
      >
        {/* Continue Writing hero — full width above the 2-col split */}
        <section style={{ marginBottom: '24px' }}>
          <ContinueWritingHero book={recentBook} locale={locale} />
        </section>

        {/* 2-col split: books main + 300px hive rail */}
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: 'minmax(0, 1fr) 300px' }}
        >
          <div>
            <h2
              className="font-comfortaa font-bold m-0"
              style={{
                color: 'var(--brand)',
                fontSize: '16px',
                letterSpacing: '-0.01em',
                marginBottom: '14px',
              }}
            >
              Your books
            </h2>
            {/* Pass hives=[] so the grid renders books only — hives live in the rail */}
            <LibraryGrid books={books} hives={[]} locale={locale} />
          </div>

          <aside>
            <HiveRail hives={hives} locale={locale} />
          </aside>
        </div>
      </div>
    </main>
  )
}
