import { requireAuth } from '@/lib/require-auth'
import {
  listFriendsAction,
  listPendingFriendRequestsAction,
} from '@/lib/actions/friendships.actions'
import { FriendsTabs } from './_components/friends-tabs'

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ tab?: string }> }

export const dynamic = 'force-dynamic'

export default async function FriendsPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { tab } = await searchParams
  await requireAuth()

  const [friendsResult, pendingResult] = await Promise.all([
    listFriendsAction(),
    listPendingFriendRequestsAction(),
  ])

  const friends = friendsResult.success ? friendsResult.data : []
  const incoming = pendingResult.success ? pendingResult.data.incoming : []
  const outgoing = pendingResult.success ? pendingResult.data.outgoing : []

  const initialTab = tab === 'pending' || tab === 'sent' ? tab : 'friends'

  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <h1
          className="text-white text-2xl mb-1"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
        >
          Friends
        </h1>
        <p className="text-[#888] text-[13px] mb-6">
          Friends can read each other&rsquo;s books set to <span className="text-[#aaa]">Friends</span> visibility.
        </p>

        <FriendsTabs
          locale={locale}
          initialTab={initialTab}
          friends={friends}
          incoming={incoming}
          outgoing={outgoing}
        />
      </div>
    </div>
  )
}
