import { Plus } from 'lucide-react'
import { getUserHivesView } from '@/lib/actions/hive.actions'
import { PageHead } from '@/components/community/page-head'
import { NewHiveButton } from './_components/new-hive-button'
import { HiveIndexCard } from './_components/hive-index-card'

export default async function HivesIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const hivesResult = await getUserHivesView()
  const hives = hivesResult.success ? hivesResult.data : []

  return (
    <main className="cm-main">
      <div className="cm-wrap w-5xl">
        <PageHead
          title="Hives"
          subtitle="Your collaborative writing groups — outlines, wikis, and chapters shared across members."
          back={{ href: `/${locale}/community`, label: 'community' }}
          headerSlot={<NewHiveButton />}
        />

        {hives.length === 0 ? (
          <div
            className="empty-hero"
            style={{
              borderRadius: 'var(--r-card)',
              padding: '48px 24px',
              textAlign: 'center',
              border: 'var(--br-card)',
              background:
                'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
              boxShadow: 'var(--sh-card)',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '20px',
                color: 'var(--canvas-dark-ink-strong)',
                margin: '0 0 8px',
              }}
            >
              You&apos;re not in any hives yet
            </h2>
            <p
              style={{
                color: 'var(--canvas-dark-ink-muted)',
                fontSize: '14px',
                margin: '0 0 20px',
                maxWidth: '46ch',
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              Hives let you collaborate on a book with other writers — shared
              outlines, wikis, and chapter submissions.
            </p>
            <NewHiveButton>
              {(onTrigger) => (
                <button
                  type="button"
                  onClick={onTrigger}
                  className="inline-flex items-center gap-2 px-5 h-9 rounded-[var(--r-pill)] text-[13px] font-semibold"
                  style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
                >
                  <Plus size={15} /> Create Your First Hive
                </button>
              )}
            </NewHiveButton>
          </div>
        ) : (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
          >
            {hives.map((hive) => (
              <HiveIndexCard key={hive.id} hive={hive} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
