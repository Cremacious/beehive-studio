import { notFound } from 'next/navigation'
import { getOptionalUserId } from '@/lib/require-auth'
import {
  getClubAction,
  listClubJoinRequestsAction,
  type ClubJoinRequestRow,
} from '@/lib/actions/book-clubs.actions'
import {
  getClubProgressAction,
  type ClubProgressData,
} from '@/lib/actions/club-progress.actions'
import { InviteClaimedToast } from '@/components/invite-claimed-toast'
import { BackLinkBadge } from '@/components/community/back-link-badge'
import { ClubPageHero } from './_components/club-page-hero'
import { ClubReadingEmptyCta } from './_components/club-empty-ctas'
import { ClubReadingCell } from './_components/club-reading-cell'
import { ClubInfoSidebar } from './_components/club-info-sidebar'
import { ClubDiscussionsCell } from './_components/club-discussions-cell'
import { ClubQueueCell } from './_components/club-queue-cell'

const EMPTY_PROGRESS: ClubProgressData = {
  currentProgressValue: null,
  totalProgressValue: null,
  progressUnit: null,
  currentReadingGoalDescription: null,
  currentReadingGoalDeadline: null,
  currentBookId: null,
  memberProgress: [],
  onTrackCount: 0,
}

export default async function ClubDetailPage({
  params,
}: {
  params: Promise<{ locale: string; clubId: string }>
}) {
  const { locale, clubId } = await params

  const [clubResult, viewerUserId] = await Promise.all([
    getClubAction(clubId),
    getOptionalUserId(),
  ])

  if (!clubResult.success) notFound()

  const { club, viewerRole, currentBook } = clubResult.data
  const isMember = viewerRole !== null
  const isModOrOwner = viewerRole === 'OWNER' || viewerRole === 'MODERATOR'

  const progressResult = currentBook
    ? await getClubProgressAction(clubId)
    : null
  const progress =
    progressResult?.success ? progressResult.data : EMPTY_PROGRESS

  const memberCount = club.memberCount ?? 0

  let joinRequests: ClubJoinRequestRow[] = []
  if (isModOrOwner) {
    const reqResult = await listClubJoinRequestsAction({ clubId })
    if (reqResult.success) joinRequests = reqResult.data.rows
  }

  return (
    <div
      style={{
        maxWidth: 1080,
        margin: '0 auto',
        padding: '0 16px 48px',
      }}
    >
      <BackLinkBadge href={`/${locale}/community/clubs`} label="clubs" />
      <InviteClaimedToast copy={`Welcome to ${club.name}!`} />

      {/* Hero */}
      <ClubPageHero club={club} locale={locale} joinRequests={joinRequests} />

      {/* Bento grid: 3 cols, 3 fixed rows */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 0.95fr',
          gridTemplateRows: '170px 175px 200px',
          gap: 8,
          marginBottom: 32,
        }}
      >
        {/* Row 1 cols 1-2: Currently Reading (or placeholder) */}
        <div style={{ gridColumn: '1 / 3', gridRow: '1 / 2' }}>
          {currentBook ? (
            <ClubReadingCell
              clubId={clubId}
              currentBook={currentBook}
              progress={progress}
              viewerRole={viewerRole}
              viewerUserId={viewerUserId}
              memberCount={memberCount}
            />
          ) : (
            <div
              style={{
                height: '100%',
                borderRadius: 'var(--r-card)',
                background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
                boxShadow: 'var(--sh-card)',
                display: 'flex',
                flexDirection: 'column',
                padding: '12px 14px',
                boxSizing: 'border-box',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--brand)',
                  fontWeight: 700,
                  marginBottom: 8,
                  flexShrink: 0,
                }}
              >
                Currently Reading
              </span>
              <ClubReadingEmptyCta clubId={clubId} isModOrOwner={isModOrOwner} />
            </div>
          )}
        </div>

        {/* Col 3, all 3 rows: Rules + About merged sidebar */}
        <div style={{ gridColumn: '3 / 4', gridRow: '1 / 4' }}>
          <ClubInfoSidebar
            rules={club.rules ?? null}
            description={club.description ?? null}
            tags={club.tags ?? null}
            clubId={clubId}
            isModOrOwner={isModOrOwner}
          />
        </div>

        {/* Row 2 cols 1-2: Discussions preview */}
        <div style={{ gridColumn: '1 / 3', gridRow: '2 / 3' }}>
          <ClubDiscussionsCell clubId={clubId} locale={locale} isMember={isMember} />
        </div>

        {/* Row 3 cols 1-2: Up Next (expanded) */}
        <div style={{ gridColumn: '1 / 3', gridRow: '3 / 4' }}>
          <ClubQueueCell clubId={clubId} locale={locale} isModOrOwner={isModOrOwner} />
        </div>
      </div>

    </div>
  )
}
