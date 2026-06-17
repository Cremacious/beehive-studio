'use client'

import Link from 'next/link'
import type { FeedRow } from '@/lib/actions/community.actions'

function relTime(d: Date | string): string {
  const date = new Date(d)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const VERB: Record<FeedRow['type'], string> = {
  book_published: 'published',
  chapter_posted: 'published a new chapter of',
  book_liked: 'liked',
  book_commented: 'commented on',
  spark_entry_submitted: 'submitted an entry to the spark',
  spark_won_community: 'won the community vote for the Spark',
  spark_won_creator_choice: "was picked as the creator's choice for the Spark",
  hive_created: 'started a new hive',
  hive_joined: 'joined the hive',
  reading_list_created: 'created a list',
  books_added_batch: 'added books to',
  book_club_created: 'started a new book club,',
  book_club_current_book_changed: 'is now reading',
}

function subjectHref(row: FeedRow, locale: string): string | null {
  const { subject } = row
  if (!subject) return null
  switch (subject.type) {
    case 'book':
      return `/${locale}/books/${subject.id}`
    case 'chapter':
      return subject.bookId ? `/${locale}/books/${subject.bookId}/read/${subject.id}` : null
    case 'hive':
      return `/${locale}/hive/${subject.id}`
    case 'reading_list':
      return `/${locale}/community/reading-lists/${subject.id}`
    case 'book_club':
      return `/${locale}/community/clubs/${subject.id}`
    default:
      return null
  }
}

// Deterministic avatar tone picker from a string so each actor gets a stable
// color across renders. Bundle palette: blue / mint / lilac / coral / slate.
const AVATAR_TONES = ['blue', 'mint', 'lilac', 'coral', 'slate'] as const
function pickTone(seed: string): (typeof AVATAR_TONES)[number] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return AVATAR_TONES[Math.abs(h) % AVATAR_TONES.length]
}

export function ActivityEventRow({ row, locale }: { row: FeedRow; locale: string }) {
  const handle = row.actor.username
    ? `@${row.actor.username}`
    : row.actor.displayName ?? 'Someone'
  const initials = (() => {
    const src = row.actor.username ?? row.actor.displayName ?? '?'
    // Use up to 2 chars for 32px avatar legibility, matching bundle (DR, VN, EM…).
    const stripped = src.replace(/^@/, '')
    if (stripped.length >= 2) {
      return (stripped[0] + stripped[1]).toUpperCase()
    }
    return stripped[0]?.toUpperCase() ?? '?'
  })()
  const href = subjectHref(row, locale)
  const isFriendEvent = Boolean(row.isFriend)

  let verb: string
  let subjectTitle: string | null
  if (row.type === 'books_added_batch') {
    const payload = row.payload ?? {}
    const rawCount = (payload as { count?: unknown }).count
    const count = typeof rawCount === 'number' && rawCount > 0 ? rawCount : 1
    const rawTitle = (payload as { listTitle?: unknown }).listTitle
    const payloadTitle = typeof rawTitle === 'string' && rawTitle.length > 0 ? rawTitle : null
    verb = `added ${count} ${count === 1 ? 'book' : 'books'} to`
    subjectTitle = payloadTitle ?? row.subject?.title ?? null
  } else if (row.type === 'book_club_created') {
    const payload = row.payload ?? {}
    const rawName = (payload as { name?: unknown }).name
    const payloadName = typeof rawName === 'string' && rawName.length > 0 ? rawName : null
    verb = 'started a new book club,'
    subjectTitle = row.subject?.title ?? payloadName
  } else if (row.type === 'book_club_current_book_changed') {
    const payload = row.payload ?? {}
    const rawClub = (payload as { clubName?: unknown }).clubName
    const rawTo = (payload as { toBookTitle?: unknown }).toBookTitle
    const clubName =
      typeof rawClub === 'string' && rawClub.length > 0
        ? rawClub
        : row.subject?.title ?? null
    const toBookTitle = typeof rawTo === 'string' && rawTo.length > 0 ? rawTo : null
    verb = clubName ? `'s club ${clubName} is now reading` : 'is now reading'
    subjectTitle = toBookTitle
  } else {
    verb = VERB[row.type] ?? 'made an update'
    subjectTitle = row.subject?.title ?? null
  }

  // Subject always renders as bold link per bundle (no italics, no <em>).
  const subjectNode = (() => {
    if (!subjectTitle) {
      return <span style={{ color: 'var(--canvas-dark-ink-muted)' }}>[subject]</span>
    }
    if (href) {
      return <Link href={href}>{subjectTitle}</Link>
    }
    return <strong>{subjectTitle}</strong>
  })()

  const avatarTone = pickTone(row.actor.username ?? row.actor.displayName ?? row.id)

  return (
    <li
      className={isFriendEvent ? 'is-friend-event' : undefined}
      style={{ borderRadius: 'var(--r-row)' }}
    >
      <div className="feed-event">
        {row.actor.username ? (
          <Link href={`/${locale}/u/${row.actor.username}`} className="shrink-0">
            {row.actor.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.actor.avatarUrl}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <span className={`avatar s32 a-${avatarTone}`}>{initials}</span>
            )}
          </Link>
        ) : (
          <span className={`avatar s32 a-${avatarTone}`}>{initials}</span>
        )}

        <div className="min-w-0">
          <div className="fe-text">
            {row.actor.username ? (
              <Link href={`/${locale}/u/${row.actor.username}`}>{handle}</Link>
            ) : (
              <strong>{handle}</strong>
            )}{' '}
            {verb} {subjectNode}
          </div>
          <div className="fe-when">{relTime(row.createdAt)}</div>
        </div>
      </div>
    </li>
  )
}
