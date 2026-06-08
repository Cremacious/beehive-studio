'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import type { NotificationRow } from '@/lib/actions/notifications.actions'
import {
  getNotificationsAction, markNotificationReadAction,
  markAllNotificationsReadAction,
} from '@/lib/actions/notifications.actions'
import { resolveMentionDeepLink } from '@/lib/notifications/mention-deep-links'
import { cn } from '@/lib/utils'

function mentionSurfaceLabel(rt: string | null): string {
  switch (rt) {
    case 'book_club_discussion': return 'a discussion'
    case 'book_club_discussion_reply': return 'a discussion reply'
    case 'hive_discussion': return 'a hive discussion'
    case 'hive_discussion_reply': return 'a hive discussion reply'
    case 'hive_buzz_post': return 'a buzz post'
    case 'hive_annotation': return 'an annotation'
    case 'hive_suggestion': return 'a suggestion'
    case 'book_comment': return 'a book comment'
    case 'spark_entry_comment': return 'a spark comment'
    case 'spark_entry_comment_reply': return 'a spark reply'
    case 'reading_list_description': return 'a reading list'
    case 'reading_list_book_commentary': return 'a list commentary'
    case 'book_club_description': return 'a club description'
    case 'book_club_rules': return 'club rules'
    default: return 'a post'
  }
}

export function NotificationsBell() {
  const params = useParams<{ locale: string }>()
  const locale = params?.locale ?? 'en'
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  // C5b T9: track per-row loading state so MENTION rows show a spinner while
  // the server-side deep-link lookup is in flight (typically <50ms but visible
  // on cold network).
  const [pendingRowId, setPendingRowId] = useState<string | null>(null)

  async function load() {
    const result = await getNotificationsAction()
    if (result.success) {
      setNotifications(result.data.notifications)
      setUnreadCount(result.data.unreadCount)
    }
  }

  useEffect(() => { load() }, [])

  async function handleOpen() {
    setOpen(o => !o)
    if (!open) load()
  }

  async function handleMarkAllRead() {
    await markAllNotificationsReadAction()
    setUnreadCount(0)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function handleNotificationClick(n: NotificationRow) {
    // Defend against double-click while a MENTION lookup is in flight.
    if (pendingRowId === n.id) return

    await markNotificationReadAction(n.id)
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
    setUnreadCount(prev => Math.max(0, prev - 1))
    if (n.resourceId && n.type === 'HIVE_INVITE') {
      window.location.href = `/${locale}/hive/${n.resourceId}`
    } else if (n.type === 'FRIEND_REQUEST') {
      window.location.href = `/${locale}/friends?tab=requests`
    } else if (n.type === 'FRIEND_ACCEPTED') {
      window.location.href = `/${locale}/friends`
    } else if (n.type === 'CLUB_JOIN_APPROVED' && n.resourceId) {
      // CLUB_JOIN_APPROVED.resourceId IS the clubId (see book-clubs.actions.ts).
      window.location.href = `/${locale}/clubs/${n.resourceId}`
    } else if (n.type === 'CLUB_INVITE' || n.type === 'CLUB_JOIN_REQUEST') {
      // CLUB_INVITE.resourceId = inviteId; CLUB_JOIN_REQUEST.resourceId =
      // joinRequestId. Neither carries the clubId directly, so route to the
      // clubs index — matches the FRIEND_REQUEST -> /friends precedent.
      window.location.href = `/${locale}/clubs`
    } else if (n.type === 'MENTION') {
      setPendingRowId(n.id)
      try {
        const target = await resolveMentionDeepLink(
          n.resourceType ?? '',
          n.resourceId ?? '',
          locale,
        )
        window.location.href = target
      } finally {
        setPendingRowId(null)
      }
    }
  }

  const LABELS: Record<string, string> = {
    HIVE_INVITE: 'invited you to a Hive',
    TASK_ASSIGNED: 'assigned you a task',
    HIVE_COMMENT: 'commented on a chapter',
    TASK_COMPLETED: 'completed a task',
    HIVE_MEMBER_JOINED: 'joined your Hive',
    CHAPTER_EDITED: 'edited a chapter',
    NEW_FOLLOWER: 'started following you',
    NEW_LIKE: 'liked your book',
    NEW_COMMENT: 'commented on your book',
    SPARK_WIN: 'your Spark entry won!',
    FRIEND_REQUEST: 'sent you a friend request',
    FRIEND_ACCEPTED: 'accepted your friend request',
    CLUB_INVITE: 'invited you to a book club',
    CLUB_JOIN_REQUEST: 'requested to join your book club',
    CLUB_JOIN_APPROVED: 'approved your request to join their book club',
  }

  function renderLabel(n: NotificationRow): string {
    if (n.type === 'MENTION') return `mentioned you in ${mentionSurfaceLabel(n.resourceType)}`
    return LABELS[n.type] ?? n.type.toLowerCase().replace(/_/g, ' ')
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="w-10 h-10 rounded-xl inline-flex items-center justify-center text-white/55 hover:text-white hover:bg-white/[0.06] transition-colors relative"
        aria-label="Notifications"
      >
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-brand border-2 border-[#141414] flex items-center justify-center text-[9px] font-bold text-black">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-50 w-80 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-medium text-foreground">Notifications</span>
              <button onClick={handleMarkAllRead} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Mark all read</button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground text-center">No notifications.</p>
              ) : notifications.map(n => {
                const isPending = pendingRowId === n.id
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    disabled={isPending}
                    aria-busy={isPending}
                    className={cn(
                      'w-full flex gap-3 px-4 py-3 border-b border-border last:border-0 text-left hover:bg-surface-elevated transition-colors',
                      !n.read && 'bg-brand/5',
                      isPending && 'opacity-60 cursor-wait',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-relaxed">
                        <strong>{n.actor?.name ?? 'Someone'}</strong>{' '}
                        {renderLabel(n)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.createdAt).toLocaleDateString()}</p>
                    </div>
                    {isPending ? (
                      <span
                        className="w-3 h-3 rounded-full border-2 border-brand border-t-transparent animate-spin mt-1 shrink-0"
                        aria-label="Loading"
                      />
                    ) : !n.read ? (
                      <span className="w-2 h-2 rounded-full bg-brand mt-1 shrink-0" />
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
