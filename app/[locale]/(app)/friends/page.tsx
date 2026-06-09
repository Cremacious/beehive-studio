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
import { SuggestedTab } from './_components/suggested-tab'
import { UserSearch } from './_components/user-search'
import { InviteLinkDialog } from './_components/invite-link-dialog'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ tab?: string; seg?: string }>
}

export const dynamic = 'force-dynamic'

const VALID_TABS: FriendsTab[] = ['friends', 'pending', 'suggested']

function parseTab(raw: string | undefined): FriendsTab {
  if (raw && (VALID_TABS as string[]).includes(raw)) return raw as FriendsTab
  return 'friends'
}

export default async function FriendsPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { tab: rawTab } = await searchParams

  // Backward-compat redirects for legacy 4-tab URL contracts.
  // Q3 IA: requests → pending&seg=received; sent → pending&seg=sent.
  if (rawTab === 'requests') {
    redirect(`/${locale}/friends?tab=pending&seg=received`)
  }
  if (rawTab === 'sent') {
    redirect(`/${locale}/friends?tab=pending&seg=sent`)
  }

  await requireAuth()
  const activeTab = parseTab(rawTab)

  const [friendsResult, pendingResult, suggestedResult] = await Promise.all([
    listFriendsAction(),
    listPendingFriendRequestsAction(),
    activeTab === 'suggested'
      ? getSuggestedWritersAction({ limit: 20 })
      : Promise.resolve({ success: true as const, data: [] }),
  ])

  const friends = friendsResult.success ? friendsResult.data : []
  const incoming = pendingResult.success ? pendingResult.data.incoming : []
  const outgoing = pendingResult.success ? pendingResult.data.outgoing : []
  const suggested = suggestedResult.success ? suggestedResult.data : []
  const pendingCount = incoming.length + outgoing.length

  return (
    <main className="cm-main">
      <div className="cm-wrap w-3xl">
        <PageHead
          title="Friends"
          subtitle="Stay close with the people whose work you love."
          headerSlot={
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <UserSearch locale={locale} />
              <InviteLinkDialog locale={locale} />
            </div>
          }
        />

        <FriendsTabStrip
          locale={locale}
          activeTab={activeTab}
          friendsCount={friends.length}
          pendingCount={pendingCount}
          suggestedCount={activeTab === 'suggested' ? suggested.length : null}
        />

        {activeTab === 'friends' && (
          <FriendsListTab locale={locale} friends={friends} />
        )}
        {activeTab === 'pending' && (
          <PendingTab locale={locale} incoming={incoming} outgoing={outgoing} />
        )}
        {activeTab === 'suggested' && (
          <SuggestedTab locale={locale} suggested={suggested} />
        )}
      </div>
    </main>
  )
}
