'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BookOpen, ScrollText, MessageCircle, BookMarked, UserPlus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { AddBookToClubModal } from '../../_components/add-book-to-club-modal'
import { DiscussionComposer } from '../../_components/discussion-composer'
import { InviteByUsernameInput } from '../../_components/invite-by-username-input'
import { updateClubAction } from '@/lib/actions/book-clubs.actions'

// ── Shared style constants ────────────────────────────────────────────────────

const EMPTY: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  flex: 1,
  minHeight: 0,
  padding: '4px 0',
}

// Compact variant for 130px row cells (~84px content height available)
// 28px chip + 5px gap + 14px heading + 5px gap + 26px pill = 78px
const COMPACT_EMPTY: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 5,
  flex: 1,
  minHeight: 0,
}

const ICON_CHIP: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: '50%',
  background: 'rgba(255,195,0,0.10)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

const COMPACT_ICON_CHIP: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  background: 'rgba(255,195,0,0.10)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

const HEADING: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 12,
  color: 'rgba(255,255,255,0.72)',
  textAlign: 'center',
  margin: 0,
}

const SUB: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: 'rgba(255,255,255,0.35)',
  textAlign: 'center',
  margin: 0,
}

const CTA_PILL: React.CSSProperties = {
  padding: '4px 14px',
  borderRadius: 999,
  background: 'var(--brand)',
  color: 'var(--brand-ink)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  border: 'none',
  cursor: 'pointer',
}

const GHOST_PILL: React.CSSProperties = {
  ...CTA_PILL,
  background: 'none',
  border: '1px solid rgba(255,195,0,0.35)',
  color: 'rgba(255,195,0,0.7)',
}

// ── Recessed input used in rules modal ───────────────────────────────────────

const RECESSED: React.CSSProperties = {
  width: '100%',
  background: 'var(--canvas-dark-100)',
  boxShadow: 'var(--sh-inset)',
  border: 'none',
  borderRadius: 'var(--r-row)',
  padding: '10px 12px',
  fontFamily: 'var(--font-display)',
  fontSize: 13,
  color: 'var(--canvas-dark-ink)',
  resize: 'vertical',
  minHeight: 120,
  outline: 'none',
  boxSizing: 'border-box',
}

// ── 1. Currently Reading empty state ─────────────────────────────────────────

export function ClubReadingEmptyCta({
  clubId,
  isModOrOwner,
}: {
  clubId: string
  isModOrOwner: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div style={EMPTY}>
        <div style={ICON_CHIP}>
          <BookOpen aria-hidden="true" style={{ width: 20, height: 20, color: 'var(--brand)' }} />
        </div>
        <p style={HEADING}>No current book</p>
        <p style={SUB}>
          {isModOrOwner ? 'Choose what the club is reading' : 'The club has not picked a book yet'}
        </p>
        {isModOrOwner && (
          <button type="button" style={CTA_PILL} onClick={() => setOpen(true)}>
            Add a book
          </button>
        )}
      </div>

      <AddBookToClubModal
        clubId={clubId}
        open={open}
        onOpenChange={setOpen}
        defaultTarget="CURRENT"
      />
    </>
  )
}

// ── 2. Rules empty state ──────────────────────────────────────────────────────

export function ClubRulesEmptyCta({
  clubId,
  isModOrOwner,
}: {
  clubId: string
  isModOrOwner: boolean
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSave() {
    const rules = draft.trim()
    if (!rules) return
    startTransition(async () => {
      const result = await updateClubAction({ clubId, rules })
      if (result.success) {
        toast.success('Rules saved')
        setOpen(false)
        setDraft('')
        router.refresh()
      } else {
        toast.error('Could not save rules')
      }
    })
  }

  function handleOpenChange(next: boolean) {
    if (!next) setDraft('')
    setOpen(next)
  }

  return (
    <>
      <div style={EMPTY}>
        <div style={ICON_CHIP}>
          <ScrollText aria-hidden="true" style={{ width: 20, height: 20, color: 'var(--brand)' }} />
        </div>
        <p style={HEADING}>No rules yet</p>
        <p style={SUB}>
          {isModOrOwner ? 'Help members know what to expect' : 'This club has no rules set'}
        </p>
        {isModOrOwner && (
          <button type="button" style={CTA_PILL} onClick={() => setOpen(true)}>
            Add rules
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Club Rules</DialogTitle>
          </DialogHeader>
          <p
            style={{
              margin: '0 0 10px',
              fontSize: 12,
              color: 'var(--canvas-dark-ink-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            One rule per line. Members will see these on the club page.
          </p>
          <textarea
            style={RECESSED}
            placeholder={"Be respectful\nStay on topic\nNo spoilers without warnings"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
          />
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 11,
              color: 'var(--canvas-dark-ink-muted)',
              fontFamily: 'var(--font-mono)',
              textAlign: 'right',
            }}
          >
            {draft.length}/2000
          </p>
          <DialogFooter>
            <button
              type="button"
              style={{ ...GHOST_PILL, cursor: 'pointer' }}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              style={{ ...CTA_PILL, opacity: (!draft.trim() || isPending) ? 0.5 : 1 }}
              disabled={!draft.trim() || isPending}
              onClick={handleSave}
            >
              Save rules
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── 3. Discussions empty state ────────────────────────────────────────────────

export function ClubDiscussionsEmptyCta({ clubId }: { clubId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div style={EMPTY}>
        <div style={ICON_CHIP}>
          <MessageCircle
            aria-hidden="true"
            style={{ width: 20, height: 20, color: 'var(--brand)' }}
          />
        </div>
        <p style={HEADING}>No discussions yet</p>
        <p style={SUB}>Be the first to post</p>
        <button type="button" style={CTA_PILL} onClick={() => setOpen(true)}>
          Start a discussion
        </button>
      </div>

      <DiscussionComposer clubId={clubId} open={open} onOpenChange={setOpen} />
    </>
  )
}

// ── 4. Queue empty state ──────────────────────────────────────────────────────

export function ClubQueueEmptyCta({
  clubId,
  isModOrOwner,
}: {
  clubId: string
  isModOrOwner: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div style={COMPACT_EMPTY}>
        <div style={COMPACT_ICON_CHIP}>
          <BookMarked
            aria-hidden="true"
            style={{ width: 16, height: 16, color: 'var(--brand)' }}
          />
        </div>
        <p style={HEADING}>Queue is empty</p>
        {isModOrOwner ? (
          <button
            type="button"
            style={{ ...CTA_PILL, padding: '3px 12px', fontSize: 10 }}
            onClick={() => setOpen(true)}
          >
            Add a book
          </button>
        ) : (
          <p style={SUB}>Nothing lined up yet</p>
        )}
      </div>

      {isModOrOwner && (
        <AddBookToClubModal
          clubId={clubId}
          open={open}
          onOpenChange={setOpen}
          defaultTarget="QUEUE"
        />
      )}
    </>
  )
}

// ── 5. Members invite CTA (inline affordance, not full empty state) ───────────

export function ClubMembersInviteCta({ clubId }: { clubId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        style={{ ...GHOST_PILL, display: 'inline-flex', alignItems: 'center', gap: 5 }}
        onClick={() => setOpen(true)}
      >
        <UserPlus aria-hidden="true" style={{ width: 11, height: 11 }} />
        Invite
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a member</DialogTitle>
          </DialogHeader>
          <InviteByUsernameInput clubId={clubId} />
        </DialogContent>
      </Dialog>
    </>
  )
}
