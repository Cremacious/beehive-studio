import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/require-auth'
import { listBuzzPostsAction } from '@/lib/actions/hive-buzz.actions'
import { requireHiveMember } from '@/lib/hive/permissions'
import { BuzzFeed } from './_components/buzz-feed'

export default async function BuzzPage({
  params,
}: {
  params: Promise<{ hiveId: string; locale: string }>
}) {
  const { hiveId, locale } = await params
  const userId = await requireAuth()

  let viewerRole
  try {
    viewerRole = await requireHiveMember(hiveId, userId)
  } catch {
    notFound()
  }

  const result = await listBuzzPostsAction({ hiveId, limit: 20 })
  if (!result.success) notFound()

  return (
    <BuzzFeed
      initialPosts={result.data.posts}
      initialCursor={result.data.nextCursor}
      hiveId={hiveId}
      locale={locale}
      viewerRole={viewerRole}
      viewerUserId={userId}
    />
  )
}
