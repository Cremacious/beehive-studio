'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  AtSign, Heart, UserPlus, Users, Hexagon, MessageSquare,
  Bell as BellIcon, BookOpen, Sparkles, List, FileText, Edit3, StickyNote,
} from 'lucide-react'
import type { NotificationRow } from '@/lib/actions/notifications.actions'
import {
  getNotificationsAction, markNotificationReadAction,
  markAllNotificationsReadAction,
} from '@/lib/actions/notifications.actions'
import { resolveMentionDeepLink } from '@/lib/notifications/mention-deep-links'
import {
  resolveHiveSubmissionLink,
  resolveHiveSuggestionLink,
  resolveHiveAnnotationLink,
  resolveNewChapterLink,
} from '@/lib/notifications/hive-deep-links'
import { cn } from '@/lib/utils'

function iconFor(type: string) {
  switch (type) {
    case 'MENTION': return <AtSign />
    case 'NEW_LIKE': return <Heart />
    case 'NEW_FOLLOWER': return <UserPlus />
    case 'NEW_COMMENT': return <MessageSquare />
    case 'FRIEND_REQUEST':
    case 'FRIEND_ACCEPTED': return <UserPlus />
    case 'HIVE_INVITE':
    case 'HIVE_MEMBER_JOINED': return <Hexagon />
    case 'CLUB_INVITE':
    case 'CLUB_JOIN_REQUEST':
    case 'CLUB_JOIN_APPROVED': return <Users />
    case 'CHAPTER_EDITED':
    case 'HIVE_COMMENT': return <BookOpen />
    case 'NEW_CHAPTER': return <BookOpen />
    case 'SPARK_WIN': return <Sparkles />
    case 'HIVE_SUBMISSION': return <FileText />
    case 'HIVE_SUGGESTION': return <Edit3 />
    case 'HIVE_ANNOTATION': return <StickyNote />
    case 'TASK_ASSIGNED':
    case 'TASK_COMPLETED': return <List />
    default: return <BellIcon />
  }
}

function iconColor(type: string): string {
  switch (type) {
    case 'MENTION': return 'var(--brand)'
    case 'NEW_LIKE': return 'var(--status-error)'
    case 'NEW_FOLLOWER':
    case 'FRIEND_REQUEST':
    case 'FRIEND_ACCEPTED': return 'var(--list-visibility-public)'
    case 'HIVE_INVITE':
    case 'HIVE_MEMBER_JOINED': return 'var(--brand)'
    case 'CLUB_INVITE':
    case 'CLUB_JOIN_REQUEST':
    case 'CLUB_JOIN_APPROVED': return 'var(--list-visibility-friends)'
    case 'SPARK_WIN': return 'var(--brand)'
    case 'NEW_CHAPTER': return 'var(--brand)'
    case 'HIVE_SUBMISSION':
    case 'HIVE_SUGGESTION':
    case 'HIVE_ANNOTATION': return 'var(--brand)'
    default: return 'var(--canvas-dark-ink-muted)'
  }
}

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
      // resourceId is the hiveId. The recipient isn't a member yet, so the
      // hive landing 404s — route to the accept-by-id page that finds their
      // PENDING invite row and renders accept/decline. Already-member case
      // is handled inside that page via a short-circuit redirect.
      window.location.href = `/${locale}/hive/accept/${n.resourceId}`
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
    } else if (n.type === 'NEW_LIKE' && n.resourceId) {
      // resourceId is the bookId.
      window.location.href = `/${locale}/books/${n.resourceId}`
    } else if (n.type === 'NEW_COMMENT' && n.resourceId) {
      // resourceType branches: 'book' → book reader; 'spark_entry' → entry.
      if (n.resourceType === 'spark_entry') {
        // We don't carry the parent sparkId — fall back to /sparks index.
        window.location.href = `/${locale}/sparks`
      } else {
        window.location.href = `/${locale}/books/${n.resourceId}`
      }
    } else if (n.type === 'SPARK_WIN' && n.resourceId) {
      window.location.href = `/${locale}/sparks/${n.resourceId}`
    } else if (n.type === 'NEW_FOLLOWER') {
      // No actor.username on the row payload — approximate to /friends like
      // FRIEND_*. Widen NotificationRow.actor with username for precise routing.
      window.location.href = `/${locale}/friends`
    } else if (n.type === 'NEW_CHAPTER' && n.resourceId) {
      setPendingRowId(n.id)
      try {
        const target = await resolveNewChapterLink(n.resourceId, locale)
        window.location.href = target
      } finally {
        setPendingRowId(null)
      }
    } else if (n.type === 'HIVE_SUBMISSION' && n.resourceId) {
      setPendingRowId(n.id)
      try {
        const target = await resolveHiveSubmissionLink(n.resourceId, locale)
        window.location.href = target
      } finally {
        setPendingRowId(null)
      }
    } else if (n.type === 'HIVE_SUGGESTION' && n.resourceId) {
      setPendingRowId(n.id)
      try {
        const target = await resolveHiveSuggestionLink(n.resourceId, locale)
        window.location.href = target
      } finally {
        setPendingRowId(null)
      }
    } else if (n.type === 'HIVE_ANNOTATION' && n.resourceId) {
      setPendingRowId(n.id)
      try {
        const target = await resolveHiveAnnotationLink(n.resourceId, locale)
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
    NEW_CHAPTER: 'posted a new chapter',
    HIVE_SUBMISSION: 'submitted a chapter for review',
    HIVE_SUGGESTION: 'suggested an edit on your chapter',
    HIVE_ANNOTATION: 'annotated your chapter',
  }

  function renderLabel(n: NotificationRow): string {
    if (n.type === 'MENTION') return `mentioned you in ${mentionSurfaceLabel(n.resourceType)}`
    return LABELS[n.type] ?? n.type.toLowerCase().replace(/_/g, ' ')
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative inline-flex items-center justify-center"
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          background: 'var(--canvas-dark-200)',
          color: 'var(--brand)',
        }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute inline-flex items-center justify-center"
            style={{
              top: -3,
              right: -3,
              minWidth: 17,
              height: 17,
              padding: '0 4px',
              borderRadius: 999,
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 10,
              border: '2px solid var(--canvas-dark-100)',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 z-50 overflow-hidden"
            style={{
              top: 56,
              width: 380,
              borderRadius: 'var(--r-card)',
              background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
              boxShadow: 'var(--sh-card)',
              borderTop: 'var(--br-card)',
            }}
          >
            <div
              className="flex items-center justify-between"
              style={{
                padding: '15px 18px',
                borderBottom: '1px solid oklch(from var(--canvas-dark-300) l c h / 0.5)',
              }}
            >
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 15,
                  color: 'var(--canvas-dark-ink-strong)',
                  margin: 0,
                }}
              >
                Notifications
              </h3>
              {unreadCount > 0 ? (
                <button
                  onClick={handleMarkAllRead}
                  className="meta-mono"
                  style={{ fontSize: 11, color: 'var(--canvas-dark-ink-muted)' }}
                >
                  Mark all read
                </button>
              ) : (
                <span className="meta-mono" style={{ fontSize: 11, color: 'var(--canvas-dark-ink-faint)' }}>
                  0 new
                </span>
              )}
            </div>
            <ul
              className="m-0 p-0 overflow-y-auto"
              style={{ listStyle: 'none', maxHeight: 420 }}
            >
              {notifications.length === 0 ? (
                <li>
                  <p className="text-center" style={{ padding: 18, fontSize: 12, color: 'var(--canvas-dark-ink-muted)' }}>
                    No notifications.
                  </p>
                </li>
              ) : notifications.map(n => {
                const isPending = pendingRowId === n.id
                const isUnread = !n.read
                return (
                  <li
                    key={n.id}
                    onClick={() => !isPending && handleNotificationClick(n)}
                    aria-busy={isPending}
                    className={cn('grid items-start cursor-pointer transition-colors', isPending && 'opacity-60')}
                    style={{
                      gridTemplateColumns: '34px 1fr auto',
                      gap: 12,
                      padding: '13px 18px',
                      background: isUnread ? 'oklch(from var(--brand) l c h / 0.05)' : undefined,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isUnread
                        ? 'oklch(from var(--brand) l c h / 0.08)'
                        : 'var(--canvas-dark-300)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isUnread
                        ? 'oklch(from var(--brand) l c h / 0.05)'
                        : ''
                    }}
                  >
                    <span
                      className="inline-flex items-center justify-center"
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: 'var(--canvas-dark-100)',
                        boxShadow: 'var(--sh-inset)',
                        color: iconColor(n.type),
                      }}
                    >
                      <span style={{ width: 16, height: 16, display: 'inline-flex' }}>
                        {iconFor(n.type)}
                      </span>
                    </span>
                    <div>
                      <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--canvas-dark-ink)' }}>
                        <b style={{ color: 'var(--canvas-dark-ink-strong)', fontWeight: 600 }}>
                          {n.actor?.name ?? 'Someone'}
                        </b>{' '}
                        {renderLabel(n)}
                      </div>
                      <div
                        className="meta-mono"
                        style={{
                          fontSize: 10,
                          color: 'var(--canvas-dark-ink-faint)',
                          marginTop: 4,
                          letterSpacing: '0.03em',
                        }}
                      >
                        {isPending ? 'Opening…' : new Date(n.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    {isPending ? (
                      <span
                        aria-label="Resolving link"
                        className="animate-spin"
                        style={{
                          width: 15,
                          height: 15,
                          borderRadius: '50%',
                          border: '2px solid oklch(from var(--brand) l c h / 0.25)',
                          borderTopColor: 'var(--brand)',
                          marginTop: 4,
                        }}
                      />
                    ) : isUnread ? (
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: 'var(--brand)',
                          marginTop: 6,
                        }}
                      />
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
