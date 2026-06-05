import Link from 'next/link'
import { getClubsAction } from '@/lib/actions/book-clubs.actions'
import { requireAuth } from '@/lib/require-auth'
import { ClubCard } from './_components/club-card'
import { CreateClubButton } from './_components/create-club-button'

export default async function ClubsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  await requireAuth()

  const result = await getClubsAction({ filter: 'mine', limit: 20 })

  if (!result.success) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6">
        <p className="text-red-400">Failed to load your clubs.</p>
      </main>
    )
  }

  const mine = result.data.rows

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6">
      <header className="flex items-baseline justify-between mb-8">
        <div>
          <h1
            className="text-3xl font-bold text-[var(--brand)]"
            style={{ fontFamily: 'var(--font-comfortaa)' }}
          >
            Book clubs
          </h1>
          <p className="text-sm text-[var(--canvas-dark-ink-muted)] mt-1">
            Read together. Discuss what you love.
          </p>
        </div>
        <CreateClubButton locale={locale} />
      </header>

      <section className="mb-10">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-3">
          My clubs
        </h2>
        {mine.length === 0 ? (
          <p className="text-[var(--canvas-dark-ink-muted)] italic">
            Create or join a club to get started.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mine.map((club) => (
              <ClubCard key={club.id} club={club} locale={locale} />
            ))}
          </div>
        )}
      </section>

      <div className="text-center">
        <Link
          href={`/${locale}/discover?tab=clubs`}
          className="text-sm text-[var(--brand)] hover:underline"
        >
          Discover more clubs →
        </Link>
      </div>
    </main>
  )
}
