import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/require-auth'
import { listDiscussionPostsAction } from '@/lib/actions/hive-discussions.actions'
import { requireHiveMember } from '@/lib/hive/permissions'
import { DiscussionsList } from './_components/discussions-list'

export default async function DiscussionsPage({
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

  const r = await listDiscussionPostsAction({ hiveId })
  if (!r.success) notFound()

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <DiscussionsList
          posts={r.data}
          hiveId={hiveId}
          locale={locale}
          viewerRole={viewerRole}
          viewerUserId={userId}
        />
      </div>
    </main>
  )
}
