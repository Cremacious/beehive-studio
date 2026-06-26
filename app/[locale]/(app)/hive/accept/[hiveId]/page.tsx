// Accept-by-hive-id route. Used by HIVE_INVITE bell notifications: invites
// created via inviteMemberByUsernameAction don't carry a token (only link-
// style invites do), so the recipient needs a way to land on an accept screen
// keyed by the hive id alone. We look up the recipient's PENDING invite row
// for that hive and render the same accept/decline UI as the token route.

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { Hexagon, Lock, Users } from 'lucide-react'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { hiveInvites, hiveMembers, hives, userProfiles, users } from '@/db/schema'
import { eq, and, count } from 'drizzle-orm'
import { acceptHiveInviteAction, declineHiveInviteAction } from '@/lib/actions/hive.actions'
import { FREE_HIVE_MEMBER_LIMIT, getUserPremiumStatus } from '@/lib/premium'

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-150), var(--canvas-dark-100))',
      }}
      className="min-h-screen flex items-center justify-center p-4"
    >
      <div
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
        }}
        className="max-w-md w-full p-8 text-center"
      >
        {children}
      </div>
    </main>
  )
}

export default async function HiveAcceptByIdPage({
  params,
}: {
  params: Promise<{ locale: string; hiveId: string }>
}) {
  const { locale, hiveId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect(`/${locale}/sign-in`)

  // Already-member short-circuit: drop them straight into the hive landing.
  const existingMember = await db.query.hiveMembers.findFirst({
    where: and(eq(hiveMembers.hiveId, hiveId), eq(hiveMembers.userId, session.user.id)),
  })
  if (existingMember) redirect(`/${locale}/hive/${hiveId}`)

  const invite = await db.query.hiveInvites.findFirst({
    where: and(
      eq(hiveInvites.hiveId, hiveId),
      eq(hiveInvites.inviteeId, session.user.id),
      eq(hiveInvites.status, 'PENDING'),
    ),
  })

  if (!invite) {
    return (
      <PanelShell>
        <Lock className="w-10 h-10 mx-auto mb-4 text-[var(--destructive)]" />
        <h1
          style={{ color: 'var(--destructive)' }}
          className="font-comfortaa font-bold text-xl mb-2"
        >
          Invite not found
        </h1>
        <p className="text-sm text-[var(--canvas-dark-ink-muted)] mb-6">
          This invite is no longer valid. Ask the owner to send a fresh one.
        </p>
        <Link
          href={`/${locale}/studio`}
          style={{ color: 'var(--brand)' }}
          className="font-geist font-semibold text-sm"
        >
          Back to studio →
        </Link>
      </PanelShell>
    )
  }

  const [hive] = await db
    .select({
      id: hives.id,
      name: hives.name,
      ownerId: hives.ownerId,
    })
    .from(hives)
    .where(eq(hives.id, hiveId))
    .limit(1)

  if (!hive) {
    return (
      <PanelShell>
        <Lock className="w-10 h-10 mx-auto mb-4 text-[var(--destructive)]" />
        <h1
          style={{ color: 'var(--destructive)' }}
          className="font-comfortaa font-bold text-xl mb-2"
        >
          Hive no longer exists
        </h1>
        <Link
          href={`/${locale}/studio`}
          style={{ color: 'var(--brand)' }}
          className="font-geist font-semibold text-sm"
        >
          Back to studio →
        </Link>
      </PanelShell>
    )
  }

  // Resolve the inviter's @handle: hive_invites doesn't track inviter, so we
  // fall back to the hive owner — same posture as the token-style invite page.
  const [owner] = await db
    .select({ username: userProfiles.username })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.id, hive.ownerId))
    .limit(1)
  const inviterUsername = owner?.username ?? null

  const memberRows = await db
    .select({ count: count() })
    .from(hiveMembers)
    .where(eq(hiveMembers.hiveId, hiveId))
  const memberCount = Number(memberRows[0]?.count ?? 0)
  const ownerIsPremium = await getUserPremiumStatus(hive.ownerId)
  const limit = FREE_HIVE_MEMBER_LIMIT
  const overLimit = !ownerIsPremium && memberCount >= limit

  if (overLimit) {
    return (
      <PanelShell>
        <Users className="w-10 h-10 mx-auto mb-4 text-[var(--canvas-dark-ink-muted)]" />
        <h1 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-xl mb-2">
          Hive is full
        </h1>
        <p className="text-sm text-[var(--canvas-dark-ink-muted)] mb-6">
          This hive has reached the free-tier member limit. Ask the owner to upgrade to Premium.
        </p>
        <Link
          href={`/${locale}/studio`}
          style={{ color: 'var(--brand)' }}
          className="font-geist font-semibold text-sm"
        >
          Back to studio →
        </Link>
      </PanelShell>
    )
  }

  const inviteId = invite.id

  async function handleAccept() {
    'use server'
    const result = await acceptHiveInviteAction(inviteId)
    if (result.success) redirect(`/${locale}/hive/${result.data.hiveId}`)
  }
  async function handleDecline() {
    'use server'
    await declineHiveInviteAction(inviteId)
    redirect(`/${locale}/studio`)
  }

  const pct = limit > 0 ? Math.min(100, (memberCount / limit) * 100) : 0

  return (
    <PanelShell>
      <div className="mb-2" aria-hidden style={{ color: 'var(--brand)' }}>
        <Hexagon size={40} />
      </div>
      <h1
        style={{ color: 'var(--brand)' }}
        className="font-comfortaa font-bold text-2xl mt-4 mb-1"
      >
        {hive.name}
      </h1>
      {inviterUsername ? (
        <p className="text-sm font-mono text-[var(--canvas-dark-ink-muted)] mb-6">
          Invited by @{inviterUsername}
        </p>
      ) : (
        <div className="mb-6" />
      )}
      <div
        style={{
          background: 'var(--canvas-dark-100)',
          borderRadius: 'var(--r-pill)',
          boxShadow: 'var(--sh-inset)',
        }}
        className="h-2 mb-1 overflow-hidden"
      >
        <div
          style={{
            background: 'var(--brand)',
            width: `${pct}%`,
            borderRadius: 'var(--r-pill)',
          }}
          className="h-full"
        />
      </div>
      <p className="text-xs font-mono text-[var(--canvas-dark-ink-muted)] mb-6">
        {memberCount} / {ownerIsPremium ? '∞' : limit} members
      </p>
      <form action={handleAccept}>
        <button
          type="submit"
          style={{
            background: 'var(--brand)',
            color: 'var(--brand-ink)',
            borderRadius: 'var(--r-btn)',
            boxShadow: 'var(--sh-tile)',
          }}
          className="w-full font-geist font-semibold text-sm py-2.5"
        >
          Accept invite
        </button>
      </form>
      <form action={handleDecline}>
        <button
          type="submit"
          className="block w-full mt-3 text-xs font-mono text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)]"
        >
          Decline
        </button>
      </form>
    </PanelShell>
  )
}
