import { notFound } from 'next/navigation'
import { getClubAction } from '@/lib/actions/book-clubs.actions'
import { ClubHeader } from '../_components/club-header'
import { ClubTabStrip } from '../_components/club-tab-strip'
import { ClubAboutPanel } from '../_components/club-about-panel'
import { ClubDiscussionsPanel } from '../_components/club-discussions-panel'
import { ClubBooksPanel } from '../_components/club-books-panel'
import { ClubMembersPanel } from '../_components/club-members-panel'
import { ClubSchedulePanel } from '../_components/club-schedule-panel'
import { ClubSettingsPanel } from '../_components/club-settings-panel'
import { InviteClaimedToast } from '@/components/invite-claimed-toast'
import { BackLinkBadge } from '@/components/community/back-link-badge'

// Q3 IA reorder: About / Books / Discussions / Members / Schedule / Settings.
const VALID_TABS = [
  'about',
  'books',
  'discussions',
  'members',
  'schedule',
  'settings',
] as const
type Tab = (typeof VALID_TABS)[number]

function parseTab(
  input: string | undefined,
  isMember: boolean,
  isModOrOwner: boolean,
): Tab {
  void isMember
  if (input && (VALID_TABS as readonly string[]).includes(input)) {
    if (input === 'settings' && !isModOrOwner) return 'about'
    return input as Tab
  }
  // Q3: both member + non-member default to About on the cover-band landing.
  return 'about'
}

export default async function ClubDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; clubId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { locale, clubId } = await params
  const { tab: tabParam } = await searchParams

  const result = await getClubAction(clubId)
  if (!result.success) notFound()

  const { club, owner, viewerRole, viewerMembership, currentBook, memberCount } =
    result.data
  const isOwner = viewerRole === 'OWNER'
  const isMember = viewerMembership.role !== null
  const isModOrOwner = viewerRole === 'OWNER' || viewerRole === 'MODERATOR'

  const activeTab = parseTab(tabParam, isMember, isModOrOwner)

  return (
    <main className="cm-wrap w-5xl">
      <BackLinkBadge href={`/${locale}/clubs`} label="clubs" />
      <InviteClaimedToast copy={`Welcome to ${club.name}!`} />
      <ClubHeader
        club={club}
        owner={owner}
        viewerRole={viewerRole}
        viewerMembership={viewerMembership}
        memberCount={memberCount}
        isOwner={isOwner}
        locale={locale}
      />
      <ClubTabStrip
        clubId={club.id}
        activeTab={activeTab}
        isModOrOwner={isModOrOwner}
        locale={locale}
      />
      <div className="mt-6">
        {activeTab === 'about' && (
          <ClubAboutPanel club={club} currentBook={currentBook} locale={locale} />
        )}
        {activeTab === 'discussions' && (
          <ClubDiscussionsPanel
            clubId={club.id}
            viewerRole={viewerRole}
            locale={locale}
          />
        )}
        {activeTab === 'books' && (
          <ClubBooksPanel
            clubId={club.id}
            viewerRole={viewerRole}
            currentBook={currentBook}
            locale={locale}
          />
        )}
        {activeTab === 'members' && (
          <ClubMembersPanel
            clubId={club.id}
            viewerRole={viewerRole}
            locale={locale}
          />
        )}
        {activeTab === 'schedule' && (
          <ClubSchedulePanel
            clubId={club.id}
            viewerRole={viewerRole}
            currentBook={currentBook}
            locale={locale}
          />
        )}
        {activeTab === 'settings' && isModOrOwner && (
          <ClubSettingsPanel club={club} viewerRole={viewerRole} locale={locale} />
        )}
      </div>
    </main>
  )
}
