'use client'

import { useState } from 'react'
import type { HiveMemberRow } from '@/lib/actions/hive.actions'
import {
  inviteMemberByUsernameAction, generateInviteLinkAction,
  removeMemberAction,
} from '@/lib/actions/hive.actions'
import { cn } from '@/lib/utils'

type Props = {
  hiveId: string
  members: HiveMemberRow[]
  isOwner: boolean
  isEditor: boolean
  currentUserId: string
}

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
    await removeMemberAction(hiveId, userId)
    setMembers(prev => prev.filter(m => m.userId !== userId))
  }

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6">
      <h2 className="text-sm font-medium text-foreground">Members</h2>

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
        {members.map(m => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center text-xs overflow-hidden">
              {m.user.image ? <img src={m.user.image} alt="" className="w-full h-full object-cover" /> : (m.user.name?.[0] ?? '?')}
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground">{m.user.name ?? m.user.email}</p>
            </div>
            <span className={cn('text-xs px-2 py-0.5 rounded-full border', m.role === 'OWNER' ? 'border-brand/40 text-brand bg-brand/10' : 'border-border text-muted-foreground')}>
              {m.role}
            </span>
            {isOwner && m.userId !== currentUserId && m.role !== 'OWNER' && (
              <button onClick={() => handleRemove(m.userId)} className="text-xs text-muted-foreground hover:text-destructive transition-colors ml-2">Remove</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
