import { notFound } from 'next/navigation'
import {
  getClubAction,
  getClubDiscussionAction,
} from '@/lib/actions/book-clubs.actions'
import { getOptionalUserId } from '@/lib/require-auth'
import { PageHead } from '@/components/community/page-head'
import { ClubDiscussionThread } from './_components/club-discussion-thread'

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; clubId: string; discussionId: string }>
}) {
  const { locale, clubId, discussionId } = await params
  const [discussionResult, clubResult, viewerUserId] = await Promise.all([
    getClubDiscussionAction(discussionId),
    getClubAction(clubId),
    getOptionalUserId(),
  ])
  if (!discussionResult.success || !clubResult.success) notFound()

  const club = clubResult.data.club
  const discussion = discussionResult.data.discussion
  const replies = discussionResult.data.replies

  return (
    <main className="cm-main">
      <div className="cm-wrap w-3xl">
        <PageHead
          back={{
            href: `/${locale}/community/clubs/${clubId}/discussions`,
            label: 'discussions',
          }}
          title={discussion.title}
          subtitle={`in ${club.name}`}
        />
        <ClubDiscussionThread
          discussion={discussion}
          replies={replies}
          clubId={clubId}
          locale={locale}
          viewerRole={clubResult.data.viewerRole}
          viewerUserId={viewerUserId}
        />
      </div>
    </main>
  )
}
