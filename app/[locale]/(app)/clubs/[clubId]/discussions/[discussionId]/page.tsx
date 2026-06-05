import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  getClubAction,
  getClubDiscussionAction,
} from '@/lib/actions/book-clubs.actions'
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

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 sm:px-6">
      <Link
        href={`/${locale}/clubs/${clubId}?tab=discussions`}
        className="inline-block mb-4 text-xs font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)]"
      >
        ← Discussions
      </Link>
      <DiscussionDetail
        discussion={discussionResult.data.discussion}
        replies={discussionResult.data.replies}
        viewerRole={clubResult.data.viewerRole}
        clubId={clubId}
        locale={locale}
      />
    </main>
  )
}
