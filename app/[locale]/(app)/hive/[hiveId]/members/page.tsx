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
    <div className="max-w-3xl mx-auto p-6">
      <div
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
        }}
        className="p-6"
      >
        <h1 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-2xl mb-6">
          Members
        </h1>
        <HiveMembers
          hiveId={hiveId}
          locale={locale}
          members={result.data.members}
          isOwner={result.data.isOwner}
          isEditor={result.data.isEditor}
          currentUserId={session!.user.id}
        />
      </div>
    </div>
  )
}
