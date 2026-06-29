import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/require-auth'
import { listDiscussionPostsAction } from '@/lib/actions/hive-discussions.actions'
import { requireHiveMember, canPostDiscussion } from '@/lib/hive/permissions'
import { HivePageShell } from '../_components/hive-page-shell'
import { DiscussionsList } from './_components/discussions-list'
import { NewDiscussionCTA } from './_components/new-discussion-cta'

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

  const canPost = canPostDiscussion(viewerRole)

  return (
    <>
      {/* Mobile (issue #50, variant C) — outside the shell for full width. */}
      <div className="md:hidden pt-3">
        <DiscussionsList
          posts={r.data}
          hiveId={hiveId}
          locale={locale}
          viewerRole={viewerRole}
          viewerUserId={userId}
          mobile
          cta={canPost ? <NewDiscussionCTA hiveId={hiveId} fullWidth /> : undefined}
        />
      </div>

      {/* Desktop — unchanged. */}
      <div className="max-md:hidden">
        <HivePageShell
          width="wide"
          title="Discussions"
          subtitle="Talk shop with your hive."
          headerSlot={canPost ? <NewDiscussionCTA hiveId={hiveId} /> : undefined}
        >
          <DiscussionsList
            posts={r.data}
            hiveId={hiveId}
            locale={locale}
            viewerRole={viewerRole}
            viewerUserId={userId}
          />
        </HivePageShell>
      </div>
    </>
  )
}
