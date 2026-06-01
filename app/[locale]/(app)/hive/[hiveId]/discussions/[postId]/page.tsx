import { notFound, redirect } from 'next/navigation'
import { db } from '@/db'
import { hiveDiscussionPosts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { getDiscussionThreadAction } from '@/lib/actions/hive-discussions.actions'
import { requireHiveMember } from '@/lib/hive/permissions'
import { DiscussionThread } from '../_components/discussion-thread'

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

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div
          style={{
            background:
              'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            borderRadius: 'var(--r-card)',
            boxShadow: 'var(--sh-card)',
            border: 'var(--br-card)',
          }}
          className="p-6"
        >
          <DiscussionThread
            post={r.data.post}
            replies={r.data.replies}
            hiveId={hiveId}
            locale={locale}
            viewerRole={viewerRole}
            viewerUserId={userId}
          />
        </div>
      </div>
    </main>
  )
}
