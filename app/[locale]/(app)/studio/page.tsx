import { headers } from 'next/headers'
import { db } from '@/db'
import { bookTemplates, userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
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

  const session = await auth.api.getSession({ headers: await headers() })
  const viewerId = session?.user?.id ?? null

  const [templates, booksResult, hivesResult, viewerProfile] = await Promise.all([
    db
      .select({ id: bookTemplates.id, name: bookTemplates.name, genre: bookTemplates.genre })
      .from(bookTemplates)
      .where(eq(bookTemplates.isSystemTemplate, true))
      .orderBy(bookTemplates.name),
    getUserBooksAction(),
    getUserHivesView(),
    viewerId
      ? db.query.userProfiles.findFirst({
          where: eq(userProfiles.userId, viewerId),
          columns: { displayName: true, username: true },
        })
      : Promise.resolve(null),
  ])

  const books = booksResult.success ? booksResult.data : []
  const hives = hivesResult.success ? hivesResult.data : []
  const authorName =
    viewerProfile?.displayName ??
    (viewerProfile?.username ? `@${viewerProfile.username}` : null) ??
    session?.user?.name ??
    null

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
      className="relative z-[1] page-x tier-wide"
      style={{ paddingTop: 8, paddingBottom: 48 }}
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
          {/* Pass hives=[] so the grid renders books only — hives live in the rail */}
          <LibraryGrid books={books} hives={[]} locale={locale} authorName={authorName} />
        </div>

        <aside>
          <HiveRail hives={hives} locale={locale} />
        </aside>
      </div>
    </main>
  )
}
