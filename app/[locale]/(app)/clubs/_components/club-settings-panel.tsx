'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Trash2, ArrowRightLeft } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  deleteClubAction,
  type ClubSummary,
} from '@/lib/actions/book-clubs.actions'
import type { BookClubMemberRole } from '@/db/schema/social'
import { EditClubMetadataDialog } from './edit-club-metadata-dialog'
import { InviteByUsernameInput } from './invite-by-username-input'
import { InviteLinkDialog } from './invite-link-dialog'
import { PendingInvitesPanel } from './pending-invites-panel'
import { JoinRequestsPanel } from './join-requests-panel'

type Props = {
  club: ClubSummary
  viewerRole: BookClubMemberRole | null
  locale: string
}

export function ClubSettingsPanel({ club, viewerRole, locale }: Props) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Defense-in-depth: parent page should already gate the Settings tab.
  if (viewerRole !== 'OWNER' && viewerRole !== 'MODERATOR') {
    return (
      <div
        className="rounded-[var(--r-row)] p-4 text-[12px] italic"
        style={{
          background: 'var(--canvas-dark-100)',
          color: 'var(--canvas-dark-ink-muted)',
          boxShadow: 'var(--sh-inset)',
        }}
      >
        Settings are only available to club owners and moderators.
      </div>
    )
  }

  const isOwner = viewerRole === 'OWNER'

  async function handleDelete() {
    const r = await deleteClubAction({ clubId: club.id })
    if (!r.success) {
      toast.error('Could not delete club')
      return
    }
    toast.success(`Deleted "${club.name}"`)
    router.push(`/${locale}/clubs`)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Metadata */}
      <Section title="Club details" subtitle="Name, description, rules, tags, visibility, and join policy.">
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--r-pill)] text-[13px] font-semibold cursor-pointer"
          style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
        >
          <Pencil size={14} /> Edit club details
        </button>
        <EditClubMetadataDialog
          initialClub={club}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      </Section>

      {/* Invites */}
      <Section
        title="Invite members"
        subtitle="Search by username or share an invite link. Links expire after 14 days."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:flex-wrap">
          <InviteByUsernameInput clubId={club.id} />
          <InviteLinkDialog clubId={club.id} locale={locale} />
        </div>
      </Section>

      {/* Pending invites */}
      <Section
        title="Pending invites"
        subtitle="People you've invited who haven't responded yet."
      >
        <PendingInvitesPanel clubId={club.id} />
      </Section>

      {/* Join requests */}
      <Section
        title="Join requests"
        subtitle="People asking to join. Approve to add as a member."
      >
        <JoinRequestsPanel clubId={club.id} viewerRole={viewerRole} />
      </Section>

      {/* Transfer ownership — OWNER only */}
      {isOwner && (
        <Section
          title="Transfer ownership"
          subtitle="Hand the club off to another member. You become a moderator."
        >
          <button
            type="button"
            disabled
            title="Coming via T13"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--r-pill)] text-[13px] font-semibold opacity-50 cursor-not-allowed"
            style={{
              background: 'var(--canvas-dark-300)',
              color: 'var(--canvas-dark-ink-strong)',
            }}
          >
            <ArrowRightLeft size={14} /> Transfer ownership
          </button>
        </Section>
      )}

      {/* Danger zone — OWNER only */}
      {isOwner && (
        <section
          className="rounded-[var(--r-card)] p-5"
          style={{
            background: 'var(--canvas-dark-200)',
            border: '1px solid color-mix(in oklch, var(--status-error) 30%, transparent)',
            boxShadow: 'var(--sh-card)',
          }}
        >
          <h3
            className="text-[14px] font-semibold mb-1"
            style={{ color: 'var(--status-error)' }}
          >
            Danger zone
          </h3>
          <p
            className="text-[12px] mb-4"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            Deleting the club permanently removes its discussions, schedule,
            book queue, and membership records. This cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--r-pill)] text-[13px] font-semibold cursor-pointer"
            style={{
              background: 'transparent',
              color: 'var(--status-error)',
              border: '1px solid var(--status-error)',
            }}
          >
            <Trash2 size={14} /> Delete club
          </button>
          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            variant="destructive"
            title={`Delete "${club.name}"?`}
            description="This permanently removes the club and all of its discussions, schedule entries, and book queue. This cannot be undone."
            confirmLabel="Delete club"
            onConfirm={handleDelete}
          />
        </section>
      )}
    </div>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3
          className="text-[14px] font-semibold"
          style={{ color: 'var(--canvas-dark-ink-strong)' }}
        >
          {title}
        </h3>
        <p
          className="text-[12px] mt-0.5"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          {subtitle}
        </p>
      </div>
      {children}
    </section>
  )
}
