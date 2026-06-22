import { notFound, redirect } from 'next/navigation'
import { Mail, Users, Inbox } from 'lucide-react'
import {
  getClubAction,
  listClubJoinRequestsAction,
} from '@/lib/actions/book-clubs.actions'
import { BackLinkBadge } from '@/components/community/back-link-badge'
import { ClubMembersPanel } from '../../_components/club-members-panel'
import { PendingInvitesPanel } from '../../_components/pending-invites-panel'
import { JoinRequestsPanel } from '../../_components/join-requests-panel'
import { InviteByUsernameInput } from '../../_components/invite-by-username-input'
import { InviteLinkDialog } from '../../_components/invite-link-dialog'
import { SettingsCard } from './_components/settings-card'
import { RulesEditor } from './_components/rules-editor'
import {
  DetailsSection,
  AboutSection,
  PrivacySection,
  DangerSection,
} from './_components/detail-sections'

export default async function ClubSettingsPage({
  params,
}: {
  params: Promise<{ locale: string; clubId: string }>
}) {
  const { locale, clubId } = await params

  const result = await getClubAction(clubId)
  if (!result.success) notFound()

  const { club, viewerRole } = result.data
  const isModOrOwner = viewerRole === 'OWNER' || viewerRole === 'MODERATOR'
  const isOwner = viewerRole === 'OWNER'

  if (!isModOrOwner) {
    redirect(`/${locale}/community/clubs/${clubId}`)
  }

  const reqResult = await listClubJoinRequestsAction({ clubId })
  const requestsCount = reqResult.success ? reqResult.data.rows.length : 0

  return (
    <div
      style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: '0 16px 48px',
      }}
    >
      <BackLinkBadge href={`/${locale}/community/clubs/${clubId}`} label={club.name} />

      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 22,
          color: 'var(--brand)',
          margin: '0 0 6px',
        }}
      >
        Club Settings
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--canvas-dark-ink-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          margin: '0 0 22px',
        }}
      >
        Manage your club&apos;s rules, about, members and more
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <DetailsSection clubId={clubId} initialName={club.name} />

        <RulesEditor clubId={clubId} initialRules={club.rules ?? null} />

        <AboutSection
          clubId={clubId}
          initialDescription={club.description ?? null}
          initialTags={club.tags ?? null}
        />

        <PrivacySection
          clubId={clubId}
          initialVisibility={club.visibility}
          initialOpenJoin={club.openJoin}
          initialDiscoverable={club.discoverable}
        />

        <SettingsCard
          title="Members"
          icon={<Users size={16} />}
          description="Manage who's in the club and their roles."
        >
          <ClubMembersPanel clubId={clubId} viewerRole={viewerRole} locale={locale} />
        </SettingsCard>

        <SettingsCard
          title="Invites"
          icon={<Mail size={16} />}
          description="Invite by username or share a link. Links expire after 14 days."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <InviteByUsernameInput clubId={clubId} />
              <InviteLinkDialog clubId={clubId} locale={locale} />
            </div>
            <div
              style={{
                paddingTop: 14,
                borderTop: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--canvas-dark-ink-muted)',
                  margin: '0 0 8px',
                }}
              >
                Pending invites
              </p>
              <PendingInvitesPanel clubId={clubId} />
            </div>
          </div>
        </SettingsCard>

        <SettingsCard
          title="Join requests"
          icon={<Inbox size={16} />}
          description="People asking to join. Approve to add as a member."
          rightSlot={
            requestsCount > 0 ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 22,
                  height: 22,
                  borderRadius: 999,
                  background: 'var(--brand)',
                  color: 'var(--brand-ink)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '0 7px',
                }}
              >
                {requestsCount}
              </span>
            ) : null
          }
        >
          <JoinRequestsPanel clubId={clubId} viewerRole={viewerRole} />
        </SettingsCard>

        {isOwner && <DangerSection club={club} locale={locale} />}
      </div>
    </div>
  )
}
