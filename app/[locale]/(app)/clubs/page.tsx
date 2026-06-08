import Link from 'next/link'
import { getClubsAction } from '@/lib/actions/book-clubs.actions'
import { requireAuth } from '@/lib/require-auth'
import { PageHead } from '@/components/community/page-head'
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
      <main className="cm-wrap w-5xl">
        <p className="text-red-400">Failed to load your clubs.</p>
      </main>
    )
  }

  const mine = result.data.rows

  return (
    <main className="cm-wrap w-5xl">
      <PageHead
        title="Book clubs"
        subtitle="Read together with friends. Discuss, schedule, and keep up with the current book."
        headerSlot={<CreateClubButton locale={locale} />}
      />

      <div className="sec-block">
        <div className="sec-label">
          <h2>My clubs</h2>
          <span className="count meta-mono">
            {mine.length} {mine.length === 1 ? 'joined' : 'joined'}
          </span>
        </div>
        {mine.length === 0 ? (
          <p className="text-[var(--canvas-dark-ink-muted)] italic">
            Create or join a club to get started.
          </p>
        ) : (
          <div className="grid-3">
            {mine.map((club) => (
              <ClubCard key={club.id} club={club} locale={locale} />
            ))}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <Link
          href={`/${locale}/discover?tab=clubs`}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--brand)',
            textDecoration: 'none',
          }}
        >
          Discover more clubs →
        </Link>
      </div>
    </main>
  )
}
