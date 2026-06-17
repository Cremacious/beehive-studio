import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/require-auth'
import {
  listFriendsAction,
  listPendingFriendRequestsAction,
} from '@/lib/actions/friendships.actions'
import { getSuggestedWritersAction } from '@/lib/actions/community.actions'
import { PageHead } from '@/components/community/page-head'
import {
  FriendsTabStrip,
  type FriendsTab,
} from './_components/friends-tab-strip'
import { FriendsListTab } from './_components/friends-list-tab'
import { PendingTab } from './_components/pending-tab'
import { FindTab } from './_components/find-tab'
import { FriendsSuggestedRail } from './_components/friends-suggested-rail'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ tab?: string; seg?: string }>
}

export const dynamic = 'force-dynamic'

const VALID_TABS: FriendsTab[] = ['friends', 'pending', 'find']

function parseTab(raw: string | undefined): FriendsTab {
  if (raw && (VALID_TABS as string[]).includes(raw)) return raw as FriendsTab
  return 'friends'
}

export default async function FriendsPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { tab: rawTab } = await searchParams

  // Backward-compat redirects for legacy URL contracts.
  if (rawTab === 'requests') {
    redirect(`/${locale}/community/friends?tab=pending&seg=received`)
  }
  if (rawTab === 'sent') {
    redirect(`/${locale}/community/friends?tab=pending&seg=sent`)
  }
  // Suggested moved to right rail; land on Friends.
  if (rawTab === 'suggested') {
    redirect(`/${locale}/community/friends?tab=friends`)
  }

  await requireAuth()
  const activeTab = parseTab(rawTab)

  const [friendsResult, pendingResult, suggestedResult] = await Promise.all([
    listFriendsAction(),
    listPendingFriendRequestsAction(),
    getSuggestedWritersAction({ limit: 20 }),
  ])

  const friends = friendsResult.success ? friendsResult.data : []
  const incoming = pendingResult.success ? pendingResult.data.incoming : []
  const outgoing = pendingResult.success ? pendingResult.data.outgoing : []
  const suggested = suggestedResult.success ? suggestedResult.data : []
  const pendingCount = incoming.length + outgoing.length

  return (
    <main
      className="mx-auto w-full px-6 pt-7 pb-6"
      style={{ maxWidth: '1120px' }}
    >
      <div className="grid items-start xl:grid-cols-[minmax(0,1fr)_300px] grid-cols-1 gap-4">
        <div className="min-w-0 w-full">
          <PageHead
            title="Friends"
            back={{ href: `/${locale}/community`, label: 'community' }}
          />

          <div style={{ marginBottom: 20 }}>
            <FriendsTabStrip
              locale={locale}
              activeTab={activeTab}
              friendsCount={friends.length}
              pendingCount={pendingCount}
            />
          </div>

          {activeTab === 'friends' && (
            <FriendsListTab locale={locale} friends={friends} />
          )}
          {activeTab === 'pending' && (
            <PendingTab locale={locale} incoming={incoming} outgoing={outgoing} />
          )}
          {activeTab === 'find' && <FindTab locale={locale} />}
        </div>
        <FriendsSuggestedRail locale={locale} suggested={suggested} />
      </div>
    </main>
  )
}
