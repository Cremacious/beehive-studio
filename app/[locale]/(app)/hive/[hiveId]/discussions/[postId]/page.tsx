import { notFound, redirect } from 'next/navigation'
import { db } from '@/db'
import { hiveDiscussionPosts, userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { getDiscussionThreadAction } from '@/lib/actions/hive-discussions.actions'
import { requireHiveMember } from '@/lib/hive/permissions'
import { HivePageShell } from '../../_components/hive-page-shell'
import { DiscussionThread } from '../_components/discussion-thread'

function deriveTitle(body: string): string {
  return (body.split('\n')[0] || 'Discussion').slice(0, 80)
}

export default async function DiscussionThreadPage({
  params,
}: {
  params: Promise<{ hiveId: string; locale: string; postId: string }>
}) {
  const { hiveId, locale, postId } = await params
  const userId = await requireAuth()

  const r = await getDiscussionThreadAction(postId)
  if (!r.success) {
    if (r.error === 'NOT_TOP_LEVEL') {
      // Walk up to the top-level parent and redirect there.
      const child = await db.query.hiveDiscussionPosts.findFirst({
        where: eq(hiveDiscussionPosts.id, postId),
        columns: { parentId: true },
      })
      if (child?.parentId) {
        redirect(`/${locale}/hive/${hiveId}/discussions/${child.parentId}`)
      }
      notFound()
    }
    notFound()
  }

  let viewerRole
  try {
    viewerRole = await requireHiveMember(hiveId, userId)
  } catch {
    notFound()
  }

  const viewerProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
    columns: { username: true, avatarUrl: true },
  })

  const { post, replies } = r.data
  const title = deriveTitle(post.body)
  const subtitle = post.username ? `Started by @${post.username}` : 'Started by unknown'

  return (
    <>
      {/* Mobile (issue #50) — full-width outside the shell, own slim header. */}
      <div className="md:hidden">
        <DiscussionThread
          post={post}
          replies={replies}
          hiveId={hiveId}
          locale={locale}
          viewerRole={viewerRole}
          viewerUserId={userId}
          viewerUsername={viewerProfile?.username ?? null}
          viewerAvatarUrl={viewerProfile?.avatarUrl ?? null}
          mobile
          title={title}
        />
      </div>

      {/* Desktop — unchanged. */}
      <div className="max-md:hidden">
        <HivePageShell
          width="wide"
          title={title}
          subtitle={subtitle}
          back={{
            href: `/${locale}/hive/${hiveId}/discussions`,
            label: 'discussions',
          }}
        >
          <DiscussionThread
            post={post}
            replies={replies}
            hiveId={hiveId}
            locale={locale}
            viewerRole={viewerRole}
            viewerUserId={userId}
            viewerUsername={viewerProfile?.username ?? null}
            viewerAvatarUrl={viewerProfile?.avatarUrl ?? null}
          />
        </HivePageShell>
      </div>
    </>
  )
}
