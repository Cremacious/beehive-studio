'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Search, Link2, UserPlus, Check } from 'lucide-react'
import {
  searchUsersAction,
  sendFriendRequestAction,
  type UserSearchResult,
} from '@/lib/actions/friendships.actions'
import { createFriendInviteAction } from '@/lib/actions/friend-invites.actions'
import { Avatar } from './shared'

type Props = {
  locale: string
}

function formatExpiry(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function FindTab({ locale }: Props) {
  // ─── Search state ────────────────────────────────────────────────────────
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [sent, setSent] = useState<Set<string>>(new Set())
  const [, startSearchTx] = useTransition()
  const [, startSendTx] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 300ms debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    if (trimmed.length < 1) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(() => {
      startSearchTx(async () => {
        const r = await searchUsersAction({ query: trimmed, limit: 12 })
        if (r.success) setResults(r.data)
        else setResults([])
        setSearching(false)
      })
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  function handleAdd(userId: string, username: string | null) {
    if (sent.has(userId)) return
    setSent((prev) => new Set(prev).add(userId))
    startSendTx(async () => {
      const r = await sendFriendRequestAction({ recipientId: userId })
      if (!r.success) {
        setSent((prev) => {
          const next = new Set(prev)
          next.delete(userId)
          return next
        })
        toast.error(r.error)
      } else {
        toast.success(
          r.data.autoAccepted
            ? `You and @${username ?? 'them'} are now friends`
            : `Friend request sent`,
        )
      }
    })
  }

  // ─── Invite link state ───────────────────────────────────────────────────
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [inviteExpiresAt, setInviteExpiresAt] = useState<Date | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [generatingInvite, startInviteTx] = useTransition()

  function generateInvite() {
    if (inviteUrl) return
    setInviteError(null)
    startInviteTx(async () => {
      const r = await createFriendInviteAction()
      if (!r.success) {
        setInviteError(r.error)
        return
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      setInviteUrl(`${origin}/${locale}/friend-invite/${r.data.token}`)
      setInviteExpiresAt(r.data.expiresAt)
    })
  }

  async function handleCopy() {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      toast.success('Link copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy link')
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <section
      className="rounded-2xl flex flex-col overflow-hidden"
      style={{
        minHeight: 480,
        background:
          'linear-gradient(180deg, var(--canvas-dark-200), var(--canvas-dark-150))',
        boxShadow:
          '0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
      aria-label="Find friends"
    >
      <div
        className="px-4 pt-4 pb-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        <h2
          className="text-[10px] font-bold uppercase tracking-[0.1em]"
          style={{ color: 'var(--brand)', fontFamily: 'var(--font-display)' }}
        >
          Find friends
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ─── Search block ───────────────────────────────────────────── */}
        <div
          className="px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
        >
          <div
            className="text-[10px] font-bold uppercase tracking-[0.08em] mb-2"
            style={{
              color: 'var(--canvas-dark-ink-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            Search by name or @username
          </div>
          <div className="relative">
            <Search
              size={14}
              aria-hidden="true"
              className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: 12, color: 'var(--canvas-dark-ink-muted)' }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try @username or a display name"
              aria-label="Search friends to add"
              className="w-full text-[13px] rounded-lg outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)]"
              style={{
                background: 'var(--canvas-dark-100)',
                boxShadow: 'var(--sh-inset)',
                color: 'var(--canvas-dark-ink)',
                padding: '10px 12px 10px 36px',
                border: 'none',
              }}
            />
          </div>

          {/* Results */}
          <div className="mt-3 flex flex-col">
            {query.trim().length === 0 ? null : searching && results.length === 0 ? (
              <p
                className="text-[12px] py-2"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                Searching…
              </p>
            ) : results.length === 0 ? (
              <p
                className="text-[12px] py-2"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                No matches for &ldquo;{query}&rdquo;.
              </p>
            ) : (
              results.map((u, i) => {
                const label = u.displayName ?? u.username ?? 'Unknown'
                const isSent = sent.has(u.userId)
                return (
                  <div
                    key={u.userId}
                    className="flex items-center gap-3 py-2.5"
                    style={{
                      borderTop:
                        i === 0
                          ? 'none'
                          : '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <Avatar url={u.avatarUrl} label={label} size={36} />
                    <div className="flex-1 min-w-0">
                      <Link
                        href={u.username ? `/${locale}/u/${u.username}` : '#'}
                        className="text-[13px] font-bold no-underline truncate block"
                        style={{
                          color: 'var(--canvas-dark-ink-strong)',
                          fontFamily: 'var(--font-display)',
                        }}
                      >
                        {label}
                      </Link>
                      {u.username ? (
                        <p
                          className="text-[11px] truncate"
                          style={{
                            color: 'var(--canvas-dark-ink-muted)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          @{u.username}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdd(u.userId, u.username)}
                      disabled={isSent}
                      aria-label={
                        isSent
                          ? 'Friend request sent'
                          : `Send friend request to ${label}`
                      }
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer disabled:cursor-default"
                      style={{
                        background: isSent
                          ? 'rgba(255,255,255,0.06)'
                          : 'var(--brand)',
                        color: isSent
                          ? 'var(--canvas-dark-ink-muted)'
                          : 'var(--brand-ink)',
                        border: isSent
                          ? '1px solid rgba(255,255,255,0.08)'
                          : 'none',
                      }}
                    >
                      {isSent ? (
                        <>
                          <Check size={11} aria-hidden="true" /> Sent
                        </>
                      ) : (
                        <>
                          <UserPlus size={11} aria-hidden="true" /> Add
                        </>
                      )}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ─── Divider ───────────────────────────────────────────────── */}
        <div
          className="text-[10px] font-bold uppercase tracking-[0.12em] text-center py-3"
          style={{
            color: 'var(--canvas-dark-ink-faint)',
            fontFamily: 'var(--font-mono)',
          }}
          aria-hidden="true"
        >
          — OR —
        </div>

        {/* ─── Invite link block ─────────────────────────────────────── */}
        <div className="px-5 pb-5 pt-1">
          <div
            className="text-[10px] font-bold uppercase tracking-[0.08em] mb-2"
            style={{
              color: 'var(--canvas-dark-ink-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            Share an invite link
          </div>
          {inviteError ? (
            <p
              className="text-[12px] rounded-lg p-3"
              style={{
                background: 'var(--canvas-dark-100)',
                color: 'var(--canvas-dark-ink-muted)',
                boxShadow: 'var(--sh-inset)',
              }}
            >
              Could not generate an invite link. Please try again.
            </p>
          ) : inviteUrl ? (
            <>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Link2
                    size={14}
                    aria-hidden="true"
                    className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ left: 12, color: 'var(--canvas-dark-ink-muted)' }}
                  />
                  <input
                    type="text"
                    readOnly
                    value={inviteUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label="Invite URL"
                    className="w-full text-[12px] rounded-lg outline-none"
                    style={{
                      background: 'var(--canvas-dark-100)',
                      boxShadow: 'var(--sh-inset)',
                      color: 'var(--canvas-dark-ink)',
                      padding: '10px 12px 10px 36px',
                      border: 'none',
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-bold px-4 py-2.5 rounded-lg cursor-pointer"
                  style={{
                    background: 'var(--brand)',
                    color: 'var(--brand-ink)',
                  }}
                  aria-live="polite"
                >
                  {copied ? 'Copied ✓' : 'Copy'}
                </button>
              </div>
              {inviteExpiresAt ? (
                <p
                  className="text-[10px] mt-2"
                  style={{ color: 'var(--canvas-dark-ink-faint)' }}
                >
                  Link expires {formatExpiry(inviteExpiresAt)}. Anyone who opens
                  it will be friended with you when they sign in.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={generateInvite}
                disabled={generatingInvite}
                className="inline-flex items-center gap-1.5 text-[12px] font-bold px-4 py-2 rounded-lg cursor-pointer disabled:opacity-60"
                style={{
                  background: 'var(--brand)',
                  color: 'var(--brand-ink)',
                }}
              >
                <Link2 size={13} aria-hidden="true" />
                {generatingInvite ? 'Generating…' : 'Generate invite link'}
              </button>
              <p
                className="text-[11px] mt-2"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                Share a one-time link with anyone. They&apos;re friended with you
                automatically when they sign in.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
