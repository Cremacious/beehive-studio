import Link from 'next/link'
import { getListsAction } from '@/lib/actions/reading-lists.actions'
import { ListCard } from './_components/list-card'
import { CreateListButton } from './_components/create-list-button'

export default async function ReadingListsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  const [mineResult, followingResult] = await Promise.all([
    getListsAction({ filter: 'mine', limit: 20 }),
    getListsAction({ filter: 'following', limit: 20 }),
  ])

  if (!mineResult.success) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6">
        <p className="text-red-400">Failed to load your lists.</p>
      </main>
    )
  }

  const mine = mineResult.data.rows
  const following = followingResult.success ? followingResult.data.rows : []

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6">
      <header className="flex items-baseline justify-between mb-8">
        <div>
          <h1
            className="text-3xl font-bold text-[var(--brand)]"
            style={{ fontFamily: 'var(--font-comfortaa)' }}
          >
            Reading lists
          </h1>
          <p className="text-sm text-[var(--canvas-dark-ink-muted)] mt-1">
            Curate the books you love. Follow lists from writers you admire.
          </p>
        </div>
        <CreateListButton locale={locale} />
      </header>

      <section className="mb-10">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-3">
          My lists
        </h2>
        {mine.length === 0 ? (
          <p className="text-[var(--canvas-dark-ink-muted)] italic">
            Create your first reading list.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mine.map((list) => (
              <ListCard
                key={list.id}
                list={list}
                locale={locale}
                viewerIsOwner
              />
            ))}
          </div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-3">
          Lists I follow
        </h2>
        {following.length === 0 ? (
          <p className="text-[var(--canvas-dark-ink-muted)] italic">
            Lists you follow appear here.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {following.map((list) => (
              <ListCard
                key={list.id}
                list={list}
                locale={locale}
                isFollowing
              />
            ))}
          </div>
        )}
      </section>

      <div className="text-center">
        <Link
          href={`/${locale}/discover?tab=lists`}
          className="text-sm text-[var(--brand)] hover:underline"
        >
          Discover more lists →
        </Link>
      </div>
    </main>
  )
}
