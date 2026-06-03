'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import type { HiveMemberRow } from '@/lib/actions/hive.actions'
import {
  inviteMemberByUsernameAction,
  generateInviteLinkAction,
  removeMemberAction,
  updateMemberRoleAction,
} from '@/lib/actions/hive.actions'
import { FREE_HIVE_MEMBER_LIMIT } from '@/lib/premium'
import { HivePill } from './hive-pill'
import { HiveSectionDivider } from './hive-section-divider'

type Role = 'OWNER' | 'MODERATOR' | 'CONTRIBUTOR' | 'BETA_READER'

type Props = {
  hiveId: string
  locale: string
  members: HiveMemberRow[]
  isOwner: boolean
  isEditor: boolean
  currentUserId: string
}

const ASSIGNABLE_ROLES: Role[] = ['MODERATOR', 'CONTRIBUTOR', 'BETA_READER']

const ROLE_LABEL: Record<Role, string> = {
  OWNER: 'Owner',
  MODERATOR: 'Moderator',
  CONTRIBUTOR: 'Contributor',
  BETA_READER: 'Beta Reader',
}

const ROLE_TOKEN: Record<Role, string> = {
  OWNER: '--role-owner',
  MODERATOR: '--role-moderator',
  CONTRIBUTOR: '--role-contributor',
  BETA_READER: '--role-reader',
}

function relTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const diffMs = Date.now() - date.getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}mo ago`
  const yr = Math.floor(day / 365)
  return `${yr}y ago`
}

export function HiveMembers({ hiveId, locale, members: initialMembers, isOwner, isEditor, currentUserId }: Props) {
  const [members, setMembers] = useState(initialMembers)
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const canInvite = isOwner || isEditor

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteUsername.trim()) return
    const result = await inviteMemberByUsernameAction(hiveId, inviteUsername.trim())
    if (result.success) {
      setInviteUsername('')
      setError(null)
      toast.success('Invite sent')
    } else {
      setError(result.error)
    }
  }

  async function handleGenerateLink() {
    setGenerating(true)
    const result = await generateInviteLinkAction(hiveId)
    setGenerating(false)
    if (result.success) {
      setInviteLink(`${window.location.origin}/${locale}/hive/invite/${result.data.token}`)
    } else {
      toast.error(result.error || 'Could not generate link')
    }
  }

  async function handleCopyLink() {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy link')
    }
  }

  async function handleRemove(userId: string) {
    const prev = members
    setMembers(prev.filter(m => m.userId !== userId))
    const result = await removeMemberAction(hiveId, userId)
    if (!result.success) {
      setMembers(prev)
      toast.error(result.error || 'Could not remove member')
    } else {
      toast.success('Member removed')
    }
  }

  async function handleRoleChange(userId: string, role: Role) {
    const prev = members
    setMembers(prev.map(m => (m.userId === userId ? { ...m, role } : m)))
    const result = await updateMemberRoleAction(hiveId, userId, role)
    if (!result.success) {
      setMembers(prev)
      toast.error(result.error || 'Could not update role')
    } else {
      toast.success('Role updated')
    }
  }

  return (
    <>
      {canInvite && (
        <>
          <HiveSectionDivider label="Invite link" hideTopBorder>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  readOnly
                  value={inviteLink ?? ''}
                  placeholder="Generate a shareable invite link…"
                  onClick={(e) => inviteLink && e.currentTarget.select()}
                  style={{
                    background: 'var(--canvas-dark-100)',
                    borderRadius: 'var(--r-row)',
                    boxShadow: 'var(--sh-inset)',
                    border: 'var(--br-card)',
                    color: 'var(--canvas-dark-ink)',
                  }}
                  className="flex-1 px-3 py-2 text-xs font-mono focus:outline-none"
                />
                {inviteLink ? (
                  <>
                    <button
                      onClick={handleCopyLink}
                      style={{
                        background: 'var(--brand)',
                        color: 'var(--brand-ink)',
                        borderRadius: 'var(--r-btn)',
                        boxShadow: 'var(--sh-tile)',
                      }}
                      className="font-geist font-semibold text-sm px-3 py-2"
                    >
                      Copy
                    </button>
                    <button
                      onClick={handleGenerateLink}
                      disabled={generating}
                      style={{
                        background: 'var(--canvas-dark-200)',
                        color: 'var(--canvas-dark-ink)',
                        borderRadius: 'var(--r-btn)',
                        boxShadow: 'var(--sh-tile)',
                        border: 'var(--br-card)',
                      }}
                      className="font-geist text-xs px-3 py-2 disabled:opacity-50"
                    >
                      {generating ? '…' : 'Regenerate'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleGenerateLink}
                    disabled={generating}
                    style={{
                      background: 'var(--brand)',
                      color: 'var(--brand-ink)',
                      borderRadius: 'var(--r-btn)',
                      boxShadow: 'var(--sh-tile)',
                    }}
                    className="font-geist font-semibold text-sm px-3 py-2 disabled:opacity-50"
                  >
                    {generating ? '…' : 'Generate'}
                  </button>
                )}
              </div>
              <p className="text-xs font-mono" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                {members.length} / {FREE_HIVE_MEMBER_LIMIT} members
              </p>
            </div>
          </HiveSectionDivider>

          <HiveSectionDivider label="Invite by username">
            <form onSubmit={handleInvite} className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  value={inviteUsername}
                  onChange={e => setInviteUsername(e.target.value)}
                  placeholder="Username…"
                  style={{
                    background: 'var(--canvas-dark-100)',
                    borderRadius: 'var(--r-row)',
                    boxShadow: 'var(--sh-inset)',
                    border: 'var(--br-card)',
                    color: 'var(--canvas-dark-ink)',
                  }}
                  className="flex-1 px-3 py-2 text-sm focus:outline-none"
                />
                <button
                  type="submit"
                  style={{
                    background: 'var(--brand)',
                    color: 'var(--brand-ink)',
                    borderRadius: 'var(--r-btn)',
                    boxShadow: 'var(--sh-tile)',
                  }}
                  className="font-geist font-semibold text-sm px-4 py-2"
                >
                  Invite
                </button>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </form>
          </HiveSectionDivider>
        </>
      )}

      <HiveSectionDivider label="Members" hideTopBorder={!canInvite}>
        <div
          className="overflow-hidden rounded-[var(--r-row)]"
          style={{ border: 'var(--br-card)' }}
        >
          <div
            className="grid grid-cols-[1fr_140px_60px] gap-3 px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider"
            style={{
              background: 'var(--canvas-dark-100)',
              borderTop: 'var(--br-card)',
              borderBottom: 'var(--br-card)',
              color: 'var(--canvas-dark-ink-muted)',
            }}
          >
            <span>Member</span>
            <span>Role</span>
            <span className="text-right">Actions</span>
          </div>
          <ul className="divide-y divide-[var(--canvas-dark-300)]/40">
            {members.map(m => {
              const role = m.role as Role
              const isSelf = m.userId === currentUserId
              const isMemberOwner = role === 'OWNER'
              const canChangeRole = isOwner && !isSelf && !isMemberOwner
              const canRemove = (isOwner || isEditor) && !isSelf && !isMemberOwner
              return (
                <li
                  key={m.id}
                  className="grid grid-cols-[1fr_140px_60px] items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--canvas-dark-300)]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-xs overflow-hidden flex-shrink-0"
                      style={{ background: 'var(--canvas-dark-200)', color: 'var(--canvas-dark-ink-strong)' }}
                    >
                      {m.user.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.user.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (m.user.name?.[0] ?? '?').toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-comfortaa font-semibold text-sm truncate"
                        style={{ color: 'var(--canvas-dark-ink-strong)' }}
                      >
                        {m.user.name ?? m.user.email}
                      </p>
                      <p
                        className="text-xs font-mono truncate"
                        style={{ color: 'var(--canvas-dark-ink-muted)' }}
                      >
                        Joined {relTime(m.joinedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="min-w-0">
                    {canChangeRole ? (
                      <select
                        value={role}
                        onChange={e => handleRoleChange(m.userId, e.target.value as Role)}
                        style={{
                          background: 'var(--canvas-dark-100)',
                          borderRadius: 'var(--r-row)',
                          boxShadow: 'var(--sh-inset)',
                          border: 'var(--br-card)',
                          color: 'var(--canvas-dark-ink)',
                        }}
                        className="text-xs font-mono px-2 py-1 focus:outline-none w-full"
                      >
                        {ASSIGNABLE_ROLES.map(r => (
                          <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                        ))}
                      </select>
                    ) : (
                      <HivePill token={ROLE_TOKEN[role]}>{ROLE_LABEL[role]}</HivePill>
                    )}
                  </div>
                  <div className="flex justify-end">
                    {canRemove && (
                      <button
                        onClick={() => handleRemove(m.userId)}
                        aria-label="Remove member"
                        className="p-1.5 rounded-md transition-colors"
                        style={{ color: 'var(--canvas-dark-ink-muted)' }}
                      >
                        <X className="w-4 h-4 hover:text-[var(--destructive)]" />
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </HiveSectionDivider>
    </>
  )
}
