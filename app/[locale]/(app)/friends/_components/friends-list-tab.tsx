'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  MoreVertical,
  User,
  VolumeX,
  ShieldX,
  UserMinus,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  unfriendAction,
  type FriendSummary,
} from '@/lib/actions/friendships.actions'
import { muteUserAction } from '@/lib/actions/mutes.actions'
import { blockUserAction } from '@/lib/actions/blocks.actions'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Avatar, relTime } from './shared'

type Props = {
  locale: string
  friends: FriendSummary[]
}

type DialogState =
  | { mode: 'closed' }
  | { mode: 'unfriend'; userId: string; label: string }
  | { mode: 'block'; userId: string; label: string }

const PAGE_SIZE = 8

export function FriendsListTab({ locale, friends }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [dialog, setDialog] = useState<DialogState>({ mode: 'closed' })
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  function handleMute(userId: string, label: string) {
    startTransition(async () => {
      const r = await muteUserAction({ targetUserId: userId })
      if (!r.success) toast.error(r.error)
      else toast.success(`Muted ${label}`)
    })
  }

  function confirmUnfriend(userId: string) {
    startTransition(async () => {
      const r = await unfriendAction({ otherUserId: userId })
      if (!r.success) toast.error(r.error)
      else {
        toast.success('Removed')
        router.refresh()
      }
    })
  }

  function confirmBlock(userId: string, label: string) {
    startTransition(async () => {
      const r = await blockUserAction({ targetUserId: userId })
      if (!r.success) toast.error(r.error)
      else {
        toast.success(`Blocked ${label}`)
        router.refresh()
      }
    })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return friends
    return friends.filter((f) => {
      const name = (f.displayName ?? '').toLowerCase()
      const handle = (f.username ?? '').toLowerCase()
      return name.includes(q) || handle.includes(q)
    })
  }, [friends, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const visible = filtered.slice(pageStart, pageStart + PAGE_SIZE)

  return (
    <>
      <section
        className="rounded-2xl flex flex-col overflow-hidden"
        style={{
          height: 'calc(100vh - 260px)',
          minHeight: 480,
          background:
            'linear-gradient(180deg, var(--canvas-dark-200), var(--canvas-dark-150))',
          boxShadow:
            '0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
        aria-label="Your friends"
      >
        {/* Sticky header — title + search */}
        <div
          className="flex items-center gap-3 px-4 pt-4 pb-3 shrink-0 flex-wrap"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
        >
          <div className="flex items-baseline gap-2 mr-auto">
            <h2
              className="text-[10px] font-bold uppercase tracking-[0.1em]"
              style={{ color: 'var(--brand)', fontFamily: 'var(--font-display)' }}
            >
              Your friends
            </h2>
            <span
              className="text-[10px]"
              style={{ color: 'var(--canvas-dark-ink-muted)', fontFamily: 'var(--font-mono)' }}
            >
              {filtered.length}
              {query && filtered.length !== friends.length
                ? ` of ${friends.length}`
                : ''}
            </span>
          </div>
          <div className="relative" style={{ width: 220 }}>
            <Search
              size={12}
              aria-hidden="true"
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: 10, color: 'var(--canvas-dark-ink-muted)' }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1)
              }}
              placeholder="Search friends..."
              aria-label="Search friends"
              className="w-full text-[12px] rounded-lg outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)]"
              style={{
                background: 'var(--canvas-dark-100)',
                boxShadow: 'var(--sh-inset)',
                color: 'var(--canvas-dark-ink)',
                padding: '6px 10px 6px 28px',
                border: 'none',
              }}
            />
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto px-4 py-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center gap-2">
              {query ? (
                <>
                  <p
                    className="text-[13px] font-bold"
                    style={{
                      color: 'var(--canvas-dark-ink-strong)',
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    No matches for &ldquo;{query}&rdquo;
                  </p>
                  <p
                    className="text-[12px]"
                    style={{ color: 'var(--canvas-dark-ink-muted)' }}
                  >
                    Try a different name or @handle.
                  </p>
                </>
              ) : (
                <>
                  <p
                    className="text-[13px] font-bold"
                    style={{
                      color: 'var(--canvas-dark-ink-strong)',
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    You haven&apos;t added any friends yet
                  </p>
                  <p
                    className="text-[12px]"
                    style={{ color: 'var(--canvas-dark-ink-muted)' }}
                  >
                    Use search above or browse the Suggested friends panel on the right.
                  </p>
                </>
              )}
            </div>
          ) : (
            <ul className="flex flex-col">
              {visible.map((f, i) => {
                const label = f.displayName ?? f.username ?? 'Unknown'
                return (
                  <li
                    key={f.userId}
                    className="flex items-center gap-3 py-3"
                    style={{
                      borderTop:
                        i === 0
                          ? 'none'
                          : '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <Avatar url={f.avatarUrl} label={label} size={36} />
                    <div className="flex-1 min-w-0">
                      <Link
                        href={f.username ? `/${locale}/u/${f.username}` : '#'}
                        className="text-[13px] font-bold no-underline truncate block"
                        style={{
                          color: 'var(--canvas-dark-ink-strong)',
                          fontFamily: 'var(--font-display)',
                        }}
                      >
                        {label}
                      </Link>
                      <p
                        className="text-[11px] truncate"
                        style={{
                          color: 'var(--canvas-dark-ink-muted)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {f.username ? `@${f.username}` : ''} · friends since{' '}
                        {relTime(f.friendsSince)}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          aria-label="Friend options"
                          className="p-1.5 rounded cursor-pointer"
                          style={{ color: 'var(--canvas-dark-ink-muted)' }}
                        >
                          <MoreVertical size={16} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {f.username && (
                          <DropdownMenuItem asChild>
                            <Link href={`/${locale}/u/${f.username}`}>
                              <User size={14} /> View profile
                            </Link>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault()
                            handleMute(f.userId, label)
                          }}
                        >
                          <VolumeX size={14} /> Mute
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault()
                            setDialog({
                              mode: 'block',
                              userId: f.userId,
                              label,
                            })
                          }}
                          variant="destructive"
                        >
                          <ShieldX size={14} /> Block
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault()
                            setDialog({
                              mode: 'unfriend',
                              userId: f.userId,
                              label,
                            })
                          }}
                          variant="destructive"
                        >
                          <UserMinus size={14} /> Unfriend
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Pagination footer */}
        {totalPages > 1 ? (
          <div
            className="flex items-center justify-center gap-1 px-4 py-3 shrink-0"
            style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
          >
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              style={{
                color:
                  currentPage === 1
                    ? 'var(--canvas-dark-ink-muted)'
                    : 'var(--canvas-dark-ink)',
              }}
              aria-label="Previous page"
            >
              <ChevronLeft size={12} aria-hidden="true" />
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => {
              const isActive = n === currentPage
              if (isActive) {
                return (
                  <span
                    key={n}
                    className="inline-flex items-center justify-center text-[11px] font-bold"
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 999,
                      background: 'var(--brand)',
                      color: 'var(--brand-ink)',
                    }}
                    aria-current="page"
                  >
                    {n}
                  </span>
                )
              }
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className="inline-flex items-center justify-center text-[11px] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--brand)] cursor-pointer"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    color: 'var(--canvas-dark-ink)',
                  }}
                  aria-label={`Go to page ${n}`}
                >
                  {n}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              style={{
                color:
                  currentPage === totalPages
                    ? 'var(--canvas-dark-ink-muted)'
                    : 'var(--canvas-dark-ink)',
              }}
              aria-label="Next page"
            >
              Next
              <ChevronRight size={12} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </section>

      <ConfirmDialog
        open={dialog.mode === 'unfriend'}
        onOpenChange={(open) => !open && setDialog({ mode: 'closed' })}
        title={
          dialog.mode === 'unfriend' ? `Unfriend ${dialog.label}?` : 'Unfriend?'
        }
        description="You can send another friend request later."
        confirmLabel="Unfriend"
        variant="destructive"
        onConfirm={() => {
          if (dialog.mode === 'unfriend') confirmUnfriend(dialog.userId)
        }}
      />
      <ConfirmDialog
        open={dialog.mode === 'block'}
        onOpenChange={(open) => !open && setDialog({ mode: 'closed' })}
        title={dialog.mode === 'block' ? `Block ${dialog.label}?` : 'Block?'}
        description="Blocking will unfriend, stop notifications, and hide each other across the app."
        confirmLabel="Block"
        variant="destructive"
        onConfirm={() => {
          if (dialog.mode === 'block') confirmBlock(dialog.userId, dialog.label)
        }}
      />
    </>
  )
}
