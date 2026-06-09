import Link from 'next/link'
import { BookOpen, Search } from 'lucide-react'
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
        back={{ href: `/${locale}/community`, label: 'community' }}
        headerSlot={<CreateListButton locale={locale} />}
      />

      {bothEmpty ? (
        <section className="panel">
          <div className="empty">
            <span className="glyph">
              <BookOpen />
            </span>
            <h2>No reading lists yet</h2>
            <p>
              Curate a list of books worth recommending — or follow a friend&apos;s list to
              track what they&apos;re loving.
            </p>
            <div className="cta-row">
              <CreateListButton locale={locale} />
              <Link href={`/${locale}/discover?tab=lists`} className="btn-tile">
                <Search />
                Discover lists
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {!bothEmpty && (
        <div className="sec-block">
          <div className="sec-label">
            <h2>My lists</h2>
            <span className="count meta-mono">
              {mine.length} {mine.length === 1 ? 'list' : 'lists'}
            </span>
          </div>
          {mine.length === 0 ? (
            <p className="empty-line">
              You haven&apos;t made any reading lists yet.
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
      )}

      {!bothEmpty && (
        <div className="sec-block">
          <div className="sec-label">
            <h2>Lists I follow</h2>
            <span className="count meta-mono">
              {following.length} {following.length === 1 ? 'list' : 'lists'}
            </span>
          </div>
          {following.length === 0 ? (
            <p className="empty-line">Lists you follow appear here.</p>
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
      )}

      {!bothEmpty && (
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
      )}
    </main>
  )
}
