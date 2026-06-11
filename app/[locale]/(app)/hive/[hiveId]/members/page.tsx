import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getHiveAction } from '@/lib/actions/hive.actions'
import { listFriendsAction } from '@/lib/actions/friendships.actions'
import { HivePageShell } from '../_components/hive-page-shell'
import { HiveMembers } from '../_components/hive-members'

export default async function HiveMembersPage({ params }: { params: Promise<{ locale: string; hiveId: string }> }) {
  const { locale, hiveId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  const result = await getHiveAction(hiveId).catch(() => null)
  if (!result?.success) notFound()

  // Friends list is used by the "Invite friends" panel inside <HiveMembers>.
  // Only OWNER + MODERATOR can invite, so non-inviters get an empty list to
  // avoid the round-trip — the component branches on canInvite anyway.
  const canInvite = result.data.isOwner || result.data.isEditor
  const friendsResult = canInvite ? await listFriendsAction().catch(() => null) : null
  const friends = friendsResult?.success ? friendsResult.data : []

  const memberCount = result.data.members.length
  return (
    <HivePageShell
      width="standard"
      title="Members"
      subtitle={`${memberCount} ${memberCount === 1 ? 'member' : 'members'}`}
    >
      <HiveMembers
        hiveId={hiveId}
        locale={locale}
        members={result.data.members}
        friends={friends}
        isOwner={result.data.isOwner}
        isEditor={result.data.isEditor}
        currentUserId={session!.user.id}
      />
    </HivePageShell>
  )
}
