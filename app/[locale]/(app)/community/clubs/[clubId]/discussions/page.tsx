import { notFound } from 'next/navigation'
import {
  getClubAction,
  listClubDiscussionsAction,
} from '@/lib/actions/book-clubs.actions'
import { PageHead } from '@/components/community/page-head'
import { NewDiscussionButton } from './_components/new-discussion-button'
import { StarterZone } from './_components/starter-zone'
import { DiscussionRow, SectionLabel } from './_components/discussion-row'
import { DiscussionsList } from './_components/discussions-list'

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; clubId: string }>
}) {
  const { locale, clubId } = await params

  const [clubResult, discussionsResult] = await Promise.all([
    getClubAction(clubId),
    listClubDiscussionsAction({ clubId, limit: 50 }),
  ])
  if (!clubResult.success) notFound()
  if (!discussionsResult.success) notFound()

  const club = clubResult.data.club
  const viewerRole = clubResult.data.viewerRole
  const isMember = viewerRole !== null
  const rows = discussionsResult.data.rows
  const nextCursor = discussionsResult.data.nextCursor
  const pinned = rows.filter((r) => r.isPinned)
  const unpinned = rows.filter((r) => !r.isPinned)

  return (
    <main className="cm-main">
      <div className="cm-wrap w-3xl">
        <PageHead
          back={{
            href: `/${locale}/community/clubs/${clubId}?tab=discussions`,
            label: club.name,
          }}
          title="Discussions"
          subtitle={`${rows.length}${nextCursor ? '+' : ''} total${pinned.length > 0 ? ` · ${pinned.length} pinned` : ''}`}
          headerSlot={isMember ? <NewDiscussionButton clubId={clubId} /> : undefined}
        />

        <div
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            borderRadius: 'var(--r-card)',
            boxShadow: 'var(--sh-card)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 'calc(100vh - 260px)',
          }}
        >
          {/* List section */}
          <div style={{ padding: '20px 22px 0' }}>
            {rows.length === 0 ? (
              <div
                style={{
                  padding: '32px 16px 24px',
                  textAlign: 'center',
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 15,
                    color: 'var(--canvas-dark-ink-strong)',
                    margin: '0 0 4px',
                  }}
                >
                  No discussions yet
                </p>
                <p
                  style={{
                    fontSize: 12,
                    color: 'var(--canvas-dark-ink-muted)',
                    margin: 0,
                  }}
                >
                  Be the first to post.
                </p>
              </div>
            ) : (
              <>
                {pinned.length > 0 && (
                  <>
                    <SectionLabel label="Pinned" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                      {pinned.map((d) => (
                        <DiscussionRow key={d.id} d={d} locale={locale} clubId={clubId} pinned />
                      ))}
                    </div>
                  </>
                )}
                <DiscussionsList
                  clubId={clubId}
                  locale={locale}
                  initialRows={unpinned}
                  initialCursor={nextCursor}
                />
              </>
            )}
          </div>

          {/* Flex spacer pushes starter zone to bottom of panel */}
          <div style={{ flex: 1, minHeight: 24 }} />

          {/* Starter zone — members only */}
          {isMember && (
            <StarterZone clubId={clubId} isEmpty={rows.length === 0} />
          )}
        </div>
      </div>
    </main>
  )
}
