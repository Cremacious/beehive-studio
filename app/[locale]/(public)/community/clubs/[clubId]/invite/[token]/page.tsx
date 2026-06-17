import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { claimClubInviteTokenAction } from '@/lib/actions/book-clubs.actions'
import { InviteResult } from './_components/invite-result'

type Params = { locale: string; clubId: string; token: string }

export default async function ClubInvitePage({
  params,
}: {
  params: Promise<Params>
}) {
  const { locale, clubId, token } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    const next = `/${locale}/community/clubs/${clubId}/invite/${token}`
    redirect(`/${locale}/sign-up?next=${encodeURIComponent(next)}`)
  }

  const result = await claimClubInviteTokenAction({ token })

  if (!result.success) {
    // ALREADY_MEMBER → silently bounce into the club they already belong to.
    if (result.error === 'ALREADY_MEMBER') {
      redirect(`/${locale}/community/clubs/${clubId}`)
    }
    return (
      <InviteResult
        kind="error"
        code={result.error}
        locale={locale}
        clubId={clubId}
      />
    )
  }

  // Success → redirect into the club with toast trigger param.
  redirect(`/${locale}/community/clubs/${result.data.clubId}?invite_claimed=1`)
}
