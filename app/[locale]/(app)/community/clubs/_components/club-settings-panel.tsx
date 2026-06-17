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
      <section className="panel panel-pad set-block">
        <p
          className="text-[12px] italic m-0"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          Settings are only available to club owners and moderators.
        </p>
      </section>
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
    router.push(`/${locale}/community/clubs`)
    router.refresh()
  }

  return (
    <div className="flex flex-col">
      {/* Metadata */}
      <section className="panel panel-pad set-block">
        <h3>Club details</h3>
        <p className="sd">
          Name, description, rules, tags, visibility, and join policy.
        </p>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="btn-brand btn-sm"
        >
          <Pencil /> Edit club details
        </button>
        <EditClubMetadataDialog
          initialClub={club}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      </section>

      {/* Invite members */}
      <section className="panel panel-pad set-block">
        <h3>Invite members</h3>
        <p className="sd">
          Search by username or share an invite link. Links expire after 14 days.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:flex-wrap">
          <InviteByUsernameInput clubId={club.id} />
          <InviteLinkDialog clubId={club.id} locale={locale} />
        </div>
      </section>

      {/* Pending invites */}
      <section className="panel panel-pad set-block">
        <h3>Pending invites</h3>
        <p className="sd">
          People you&apos;ve invited who haven&apos;t responded yet.
        </p>
        <PendingInvitesPanel clubId={club.id} />
      </section>

      {/* Join requests */}
      <section className="panel panel-pad set-block">
        <h3>Join requests</h3>
        <p className="sd">
          People asking to join. Approve to add as a member.
        </p>
        <JoinRequestsPanel clubId={club.id} viewerRole={viewerRole} />
      </section>

      {/* Transfer ownership — OWNER only */}
      {isOwner && (
        <section className="panel panel-pad set-block">
          <h3>Transfer ownership</h3>
          <p className="sd">
            Hand this club over to another member. You&apos;ll become a moderator.
          </p>
          <button
            type="button"
            disabled
            title="Coming via T13"
            className="btn-tile btn-sm opacity-50 cursor-not-allowed"
          >
            <ArrowRightLeft /> Transfer ownership…
          </button>
        </section>
      )}

      {/* Danger zone — OWNER only */}
      {isOwner && (
        <section className="panel panel-pad set-block danger">
          <h3>Delete club</h3>
          <p className="sd">
            This permanently deletes the club, its discussions, schedule entries,
            book queue, and membership records. This cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="btn-ghost btn-sm"
            style={{
              borderColor: 'oklch(from var(--status-error) l c h / 0.5)',
              color: 'var(--status-error)',
            }}
          >
            <Trash2 /> Delete this club
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
