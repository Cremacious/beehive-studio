import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { Lock, Users } from 'lucide-react'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { hiveInvites, hiveMembers } from '@/db/schema'
import { eq, and, count } from 'drizzle-orm'
import { joinHiveByLinkAction } from '@/lib/actions/hive.actions'
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

export default async function HiveInvitePage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect(`/${locale}/sign-in`)

  const invite = await db.query.hiveInvites.findFirst({
    where: and(eq(hiveInvites.token, token), eq(hiveInvites.status, 'PENDING')),
    with: {
      hive: {
        columns: { id: true, name: true, description: true, ownerId: true },
        with: {
          owner: {
            columns: { id: true },
            with: { profile: { columns: { username: true } } },
          },
        },
      },
    },
  })

  if (!invite || !invite.hive) {
    return (
      <PanelShell>
        <Lock className="w-10 h-10 mx-auto mb-4 text-[var(--destructive)]" />
        <h1 style={{ color: 'var(--destructive)' }} className="font-comfortaa font-bold text-xl mb-2">
          Invite expired
        </h1>
        <p className="text-sm text-[var(--canvas-dark-ink-muted)] mb-6">
          This invite link is no longer valid. Ask the owner for a fresh link.
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

  const hive = invite.hive
  const inviterUsername =
    (hive.owner as { profile?: { username: string | null } | null } | null)?.profile?.username ?? null

  // Already-member short-circuit: redirect straight into the hive.
  const existingMember = await db.query.hiveMembers.findFirst({
    where: and(eq(hiveMembers.hiveId, hive.id), eq(hiveMembers.userId, session.user.id)),
  })
  if (existingMember) {
    redirect(`/${locale}/hive/${hive.id}`)
  }

  const memberRows = await db
    .select({ count: count() })
    .from(hiveMembers)
    .where(eq(hiveMembers.hiveId, hive.id))
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

  async function handleJoin() {
    'use server'
    const result = await joinHiveByLinkAction(token)
    if (result.success) redirect(`/${locale}/hive/${result.data.hiveId}`)
  }

  const pct = limit > 0 ? Math.min(100, (memberCount / limit) * 100) : 0

  return (
    <PanelShell>
      <div className="text-4xl mb-2" aria-hidden>🐝</div>
      <h1 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-2xl mt-4 mb-1">
        {hive.name}
      </h1>
      {inviterUsername && (
        <p className="text-sm font-mono text-[var(--canvas-dark-ink-muted)] mb-6">
          Invited by @{inviterUsername}
        </p>
      )}
      {!inviterUsername && <div className="mb-6" />}
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
      <form action={handleJoin}>
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
      <Link
        href={`/${locale}/studio`}
        className="block mt-3 text-xs font-mono text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)]"
      >
        Not now
      </Link>
    </PanelShell>
  )
}
