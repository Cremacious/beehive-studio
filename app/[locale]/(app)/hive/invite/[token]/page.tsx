import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { hiveInvites } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { joinHiveByLinkAction } from '@/lib/actions/hive.actions'

export default async function HiveInvitePage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect(`/${locale}/sign-in`)

  const invite = await db.query.hiveInvites.findFirst({
    where: and(eq(hiveInvites.token, token), eq(hiveInvites.status, 'PENDING')),
    with: { hive: { columns: { id: true, name: true, description: true } } },
  })

  if (!invite) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-foreground mb-2">Invite expired or invalid</h1>
          <p className="text-sm text-muted-foreground">This invite link is no longer valid.</p>
        </div>
      </div>
    )
  }

  async function handleJoin() {
    'use server'
    const result = await joinHiveByLinkAction(token)
    if (result.success) redirect(`/${locale}/hive/${result.data.hiveId}`)
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="bg-card border border-border rounded-xl p-8 max-w-sm w-full text-center flex flex-col gap-4">
        <div className="text-3xl">🐝</div>
        <h1 className="text-lg font-semibold text-foreground">You're invited to a Hive</h1>
        <p className="text-sm font-medium text-brand">{invite.hive?.name}</p>
        {invite.hive?.description && <p className="text-sm text-muted-foreground">{invite.hive.description}</p>}
        <form action={handleJoin}>
          <button type="submit" className="w-full px-4 py-2 rounded-lg bg-brand text-black font-medium text-sm">
            Join Hive
          </button>
        </form>
      </div>
    </div>
  )
}
