import { requireAuth } from '@/lib/require-auth'
import {
  listFriendsAction,
  listPendingFriendRequestsAction,
} from '@/lib/actions/friendships.actions'
import { getSuggestedWritersAction } from '@/lib/actions/community.actions'
import {
  FriendsTabStrip,
  type FriendsTab,
} from './_components/friends-tab-strip'
import { FriendsListTab } from './_components/friends-list-tab'
import { RequestsTab } from './_components/requests-tab'
import { SentTab } from './_components/sent-tab'
import { SuggestedTab } from './_components/suggested-tab'
import { UserSearch } from './_components/user-search'
import { InviteLinkDialog } from './_components/invite-link-dialog'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ tab?: string }>
}

export const dynamic = 'force-dynamic'

const VALID_TABS: FriendsTab[] = ['friends', 'requests', 'sent', 'suggested']

function parseTab(raw: string | undefined): FriendsTab {
  if (raw && (VALID_TABS as string[]).includes(raw)) return raw as FriendsTab
  return 'friends'
}

export default async function FriendsPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { tab: rawTab } = await searchParams
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

  return (
    <div className="min-h-screen" style={{ background: '#262728' }}>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1
              className="text-[28px] leading-tight mb-1"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                color: 'var(--brand)',
              }}
            >
              Friends
            </h1>
            <p
              className="text-[13px]"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              Friends can read each other&rsquo;s books set to{' '}
              <span style={{ color: 'var(--canvas-dark-ink-strong)' }}>
                Friends
              </span>{' '}
              visibility.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <UserSearch locale={locale} />
            <InviteLinkDialog locale={locale} />
          </div>
        </div>

        <FriendsTabStrip
          locale={locale}
          activeTab={activeTab}
          friendsCount={friends.length}
          requestsCount={incoming.length}
          sentCount={outgoing.length}
        />

        {activeTab === 'friends' && (
          <FriendsListTab locale={locale} friends={friends} />
        )}
        {activeTab === 'requests' && (
          <RequestsTab locale={locale} incoming={incoming} />
        )}
        {activeTab === 'sent' && (
          <SentTab locale={locale} outgoing={outgoing} />
        )}
        {activeTab === 'suggested' && (
          <SuggestedTab locale={locale} suggested={suggested} />
        )}
      </div>
    </div>
  )
}
