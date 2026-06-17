'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Search, UserPlus } from 'lucide-react'
import {
  searchUsersAction,
  type UserSearchResult,
} from '@/lib/actions/friendships.actions'
import { inviteUserToClubAction } from '@/lib/actions/book-clubs.actions'

type Props = {
  clubId: string
}

export function InviteByUsernameInput({ clubId }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()
  const [inviting, setInviting] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    if (trimmed.length < 1) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const r = await searchUsersAction({ query: trimmed, limit: 10 })
        if (r.success) setResults(r.data)
        else setResults([])
      })
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  async function handleInvite(user: UserSearchResult) {
    if (!user.username) return
    setInviting(user.userId)
    const r = await inviteUserToClubAction({
      clubId,
      recipientUsername: user.username,
    })
    setInviting(null)
    if (!r.success) {
      const msg =
        r.error === 'INVITE_ALREADY_PENDING'
          ? 'Already invited'
          : r.error === 'ALREADY_MEMBER'
            ? 'Already a member'
            : r.error === 'USER_NOT_FOUND'
              ? 'User not found'
              : r.error === 'SELF_INVITE'
                ? "You can't invite yourself"
                : 'Could not send invite'
      toast.error(msg)
      return
    }
    toast.success(`Invited @${user.username}`)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  const showPopover = open && query.trim().length > 0

  return (
    <div ref={containerRef} className="relative w-full sm:w-[320px]">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Find by username…"
          aria-label="Search users to invite"
          className="w-full rounded-[var(--r-row)] bg-[var(--canvas-dark-100)] pl-9 pr-3 py-2 text-sm text-[var(--canvas-dark-ink)] outline-none"
          style={{ boxShadow: 'var(--sh-inset)' }}
        />
      </div>
      {showPopover && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-20 rounded-[var(--r-card)] overflow-hidden"
          style={{
            background: 'var(--canvas-dark-200)',
            boxShadow: 'var(--sh-card)',
            border: '1px solid var(--br-card)',
          }}
        >
          {results.length === 0 ? (
            <div
              className="px-3 py-3 text-[12px] italic"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              No matches
            </div>
          ) : (
            <ul className="max-h-[320px] overflow-y-auto">
              {results.map((u) => (
                <li
                  key={u.userId}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--canvas-dark-300)]"
                >
                  <div
                    className="h-7 w-7 rounded-full shrink-0 overflow-hidden"
                    style={{ background: 'var(--canvas-dark-300)' }}
                  >
                    {u.avatarUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={u.avatarUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-sm truncate"
                      style={{ color: 'var(--canvas-dark-ink-strong)' }}
                    >
                      {u.displayName ?? u.username ?? 'Unknown'}
                    </div>
                    {u.username && (
                      <div
                        className="text-[11px] font-mono truncate"
                        style={{ color: 'var(--canvas-dark-ink-muted)' }}
                      >
                        @{u.username}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleInvite(u)}
                    disabled={inviting === u.userId || !u.username}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-[var(--r-pill)] text-[12px] font-semibold disabled:opacity-50"
                    style={{
                      background: 'var(--brand)',
                      color: 'var(--brand-ink)',
                    }}
                  >
                    <UserPlus size={12} />
                    {inviting === u.userId ? 'Inviting…' : 'Invite'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
