import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getHiveAction } from '@/lib/actions/hive.actions'
import { getDiscussionPostsAction } from '@/lib/actions/hive-content.actions'
import { HiveDiscussion } from '../_components/hive-discussion'

export default async function HiveDiscussionPage({ params }: { params: Promise<{ hiveId: string }> }) {
  const { hiveId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  const [hiveResult, postsResult] = await Promise.all([
    getHiveAction(hiveId).catch(() => null),
    getDiscussionPostsAction(hiveId).catch(() => null),
  ])
  if (!hiveResult?.success) notFound()
  return (
    <HiveDiscussion
      hiveId={hiveId}
      initialPosts={postsResult?.success ? postsResult.data : []}
      currentUserId={session!.user.id}
    />
  )
}
