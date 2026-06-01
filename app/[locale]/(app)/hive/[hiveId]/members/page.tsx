import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getHiveAction } from '@/lib/actions/hive.actions'
import { HiveMembers } from '../_components/hive-members'

export default async function HiveMembersPage({ params }: { params: Promise<{ locale: string; hiveId: string }> }) {
  const { locale, hiveId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  const result = await getHiveAction(hiveId).catch(() => null)
  if (!result?.success) notFound()
  return (
    <HiveMembers
      hiveId={hiveId}
      locale={locale}
      members={result.data.members}
      isOwner={result.data.isOwner}
      isEditor={result.data.isEditor}
      currentUserId={session!.user.id}
    />
  )
}
