import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  getClubAction,
  getClubDiscussionAction,
} from '@/lib/actions/book-clubs.actions'
import { PageHead } from '@/components/community/page-head'
import { DiscussionDetail } from '../../../_components/discussion-detail'

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; clubId: string; discussionId: string }>
}) {
  const { locale, clubId, discussionId } = await params
  const [discussionResult, clubResult] = await Promise.all([
    getClubDiscussionAction(discussionId),
    getClubAction(clubId),
  ])
  if (!discussionResult.success || !clubResult.success) notFound()

  const club = clubResult.data.club

  return (
    <main className="cm-main">
      <div className="cm-wrap w-3xl">
        <Link
          href={`/${locale}/community/clubs/${clubId}?tab=discussions`}
          className="eyebrow-mono"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            textDecoration: 'none',
            marginBottom: '6px',
          }}
        >
          ← Discussions
        </Link>
        <PageHead
          eyebrow={`Discussion · in ${club.name}`}
          title={discussionResult.data.discussion.title}
        />
        <DiscussionDetail
          discussion={discussionResult.data.discussion}
          replies={discussionResult.data.replies}
          viewerRole={clubResult.data.viewerRole}
          clubId={clubId}
          locale={locale}
        />
      </div>
    </main>
  )
}
