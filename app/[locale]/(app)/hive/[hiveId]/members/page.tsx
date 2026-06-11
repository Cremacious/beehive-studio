import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getHiveAction } from '@/lib/actions/hive.actions'
import { listFriendsAction } from '@/lib/actions/friendships.actions'
import { HivePageShell } from '../_components/hive-page-shell'
import { HiveMembers } from '../_components/hive-members'
import { InviteModal } from '../_components/invite-modal'

export default async function HiveMembersPage({ params }: { params: Promise<{ locale: string; hiveId: string }> }) {
  const { locale, hiveId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  const result = await getHiveAction(hiveId).catch(() => null)
  if (!result?.success) notFound()

  // Friends list powers the "Invite a friend" block inside the InviteModal.
  // Only OWNER + MODERATOR can invite, so non-inviters skip the round-trip.
  const canInvite = result.data.isOwner || result.data.isEditor
  const friendsResult = canInvite ? await listFriendsAction().catch(() => null) : null
  const friends = friendsResult?.success ? friendsResult.data : []

  const memberCount = result.data.members.length
  const memberUserIds = new Set(result.data.members.map((m) => m.userId))

  return (
    <HivePageShell
      width="standard"
      title="Members"
      subtitle={`${memberCount} ${memberCount === 1 ? 'member' : 'members'}`}
      headerSlot={
        canInvite ? (
          <InviteModal
            hiveId={hiveId}
            locale={locale}
            friends={friends}
            memberUserIds={memberUserIds}
            memberCount={memberCount}
          />
        ) : undefined
      }
    >
      <HiveMembers
        hiveId={hiveId}
        members={result.data.members}
        isOwner={result.data.isOwner}
        isEditor={result.data.isEditor}
        currentUserId={session!.user.id}
      />
    </HivePageShell>
  )
}
