import Link from 'next/link'
import { getListsAction } from '@/lib/actions/reading-lists.actions'
import { PageHead } from '@/components/community/page-head'
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
      <main className="cm-wrap w-5xl">
        <p className="text-red-400">Failed to load your lists.</p>
      </main>
    )
  }

  const mine = mineResult.data.rows
  const following = followingResult.success ? followingResult.data.rows : []
  const bothEmpty = mine.length === 0 && following.length === 0

  return (
    <main className="cm-wrap w-5xl">
      <PageHead
        title="Reading lists"
        subtitle="Curate books worth reading. Follow friends' lists to track what they're loving."
        headerSlot={<CreateListButton locale={locale} />}
      />

      {bothEmpty ? (
        <div className="sec-block">
          <p className="text-[var(--canvas-dark-ink-muted)] italic">
            Create your first reading list to get started.
          </p>
        </div>
      ) : null}

      <div className="sec-block">
        <div className="sec-label">
          <h2>My lists</h2>
          <span className="count meta-mono">
            {mine.length} {mine.length === 1 ? 'list' : 'lists'}
          </span>
        </div>
        {mine.length === 0 ? (
          <p className="text-[var(--canvas-dark-ink-muted)] italic">
            Create your first reading list.
          </p>
        ) : (
          <div className="grid-3">
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
      </div>

      <div className="sec-block">
        <div className="sec-label">
          <h2>Lists I follow</h2>
          <span className="count meta-mono">
            {following.length} {following.length === 1 ? 'list' : 'lists'}
          </span>
        </div>
        {following.length === 0 ? (
          <p className="text-[var(--canvas-dark-ink-muted)] italic">
            Lists you follow appear here.
          </p>
        ) : (
          <div className="grid-3">
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
      </div>

      <div style={{ textAlign: 'center', marginTop: '18px' }}>
        <Link
          href={`/${locale}/discover?tab=lists`}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--brand)',
            textDecoration: 'none',
          }}
        >
          Discover more lists →
        </Link>
      </div>
    </main>
  )
}
