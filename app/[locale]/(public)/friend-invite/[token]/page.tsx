import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { claimFriendInviteAction } from '@/lib/actions/friend-invites.actions'
import { InviteResult } from './_components/invite-result'

type Params = { locale: string; token: string }

export default async function FriendInvitePage({
  params,
}: {
  params: Promise<Params>
}) {
  const { locale, token } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    const next = `/${locale}/friend-invite/${token}`
    redirect(`/${locale}/sign-up?next=${encodeURIComponent(next)}`)
  }

  const result = await claimFriendInviteAction({ token })
  if (!result.success) {
    return <InviteResult kind="error" code={result.error} locale={locale} />
  }

  const { inviterUsername, alreadyFriends } = result.data
  if (inviterUsername) {
    redirect(`/${locale}/u/${inviterUsername}?invite_claimed=1`)
  }

  return (
    <InviteResult
      kind="success"
      success={alreadyFriends ? 'already_friends' : 'accepted'}
      locale={locale}
    />
  )
}
