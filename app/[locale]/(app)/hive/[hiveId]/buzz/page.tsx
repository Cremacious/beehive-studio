import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/require-auth'
import { listBuzzPostsAction } from '@/lib/actions/hive-buzz.actions'
import { requireHiveMember, canPostBuzz } from '@/lib/hive/permissions'
import { HivePageShell } from '../_components/hive-page-shell'
import { BuzzFeed } from './_components/buzz-feed'
import { BuzzHeaderCTA } from './_components/buzz-header-cta'

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

  const canPost = canPostBuzz(viewerRole)

  return (
    <HivePageShell
      width="standard"
      mobileBleed
      title="Buzz Board"
      subtitle="Inspiration, links, and vibes from your hive."
      headerSlot={canPost ? <BuzzHeaderCTA hiveId={hiveId} /> : undefined}
    >
      <BuzzFeed
        initialPosts={result.data.posts}
        initialCursor={result.data.nextCursor}
        hiveId={hiveId}
        locale={locale}
        viewerRole={viewerRole}
        viewerUserId={userId}
      />
    </HivePageShell>
  )
}
