'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { HiveMemberRow } from '@/lib/actions/hive.actions'
import {
  inviteMemberByUsernameAction,
  generateInviteLinkAction,
  removeMemberAction,
  updateMemberRoleAction,
} from '@/lib/actions/hive.actions'
import { cn } from '@/lib/utils'

type Role = 'OWNER' | 'MODERATOR' | 'CONTRIBUTOR' | 'BETA_READER'

type Props = {
  hiveId: string
  members: HiveMemberRow[]
  isOwner: boolean
  isEditor: boolean
  currentUserId: string
}

const ASSIGNABLE_ROLES: Role[] = ['MODERATOR', 'CONTRIBUTOR', 'BETA_READER']

export function HiveMembers({ hiveId, members: initialMembers, isOwner, isEditor, currentUserId }: Props) {
  const [members, setMembers] = useState(initialMembers)
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    const result = await generateInviteLinkAction(hiveId)
    if (result.success) {
      setInviteLink(`${window.location.origin}/en/hive/invite/${result.data.token}`)
    }
  }

  async function handleRemove(userId: string) {
    const prev = members
    setMembers(prev.filter(m => m.userId !== userId))
    const result = await removeMemberAction(hiveId, userId)
    if (!result.success) {
      setMembers(prev)
      toast.error(result.error || 'Could not remove member')
    }
  }

  async function handleRoleChange(userId: string, role: Role) {
    const prev = members
    setMembers(prev.map(m => (m.userId === userId ? { ...m, role } : m)))
    const result = await updateMemberRoleAction(hiveId, userId, role)
    if (!result.success) {
      setMembers(prev)
      toast.error(result.error || 'Could not update role')
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6">
      <h2 className="text-lg font-medium text-foreground">Members</h2>

      {(isOwner || isEditor) && (
        <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Invite</h3>
          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              value={inviteUsername}
              onChange={e => setInviteUsername(e.target.value)}
              placeholder="Username…"
              className="flex-1 bg-surface-inset border border-border rounded px-3 py-1.5 text-sm outline-none focus:border-brand/40"
            />
            <button type="submit" className="px-3 py-1.5 rounded bg-brand text-black text-sm font-medium">Invite</button>
          </form>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center gap-2">
            <button onClick={handleGenerateLink} className="text-xs text-muted-foreground hover:text-foreground transition-colors underline">
              Generate invite link
            </button>
            {inviteLink && (
              <button onClick={() => navigator.clipboard.writeText(inviteLink!)} className="text-xs text-brand">Copy link</button>
            )}
          </div>
          {inviteLink && <p className="text-xs text-muted-foreground break-all">{inviteLink}</p>}
        </div>
      )}

      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {members.map(m => {
          const isSelf = m.userId === currentUserId
          const isMemberOwner = m.role === 'OWNER'
          const canChangeRole = isOwner && !isSelf && !isMemberOwner
          const canRemove = (isOwner || isEditor) && !isSelf && !isMemberOwner
          return (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center text-xs overflow-hidden flex-shrink-0">
                {m.user.image ? <img src={m.user.image} alt="" className="w-full h-full object-cover" /> : (m.user.name?.[0] ?? '?')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{m.user.name ?? m.user.email}</p>
              </div>
              {canChangeRole ? (
                <select
                  value={m.role}
                  onChange={e => handleRoleChange(m.userId, e.target.value as Role)}
                  className="text-xs bg-surface-inset border border-border rounded px-2 py-1 outline-none focus:border-brand/40"
                >
                  {ASSIGNABLE_ROLES.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              ) : (
                <span className={cn('text-xs px-2 py-0.5 rounded-full border', isMemberOwner ? 'border-brand/40 text-brand bg-brand/10' : 'border-border text-muted-foreground')}>
                  {m.role}
                </span>
              )}
              {canRemove && (
                <button onClick={() => handleRemove(m.userId)} className="text-xs text-muted-foreground hover:text-destructive transition-colors ml-2">Remove</button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
