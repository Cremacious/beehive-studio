'use client'

import Link from 'next/link'
import type { FeedRow } from '@/lib/actions/community.actions'

function relTime(d: Date | string): string {
  const date = new Date(d)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const VERB: Record<FeedRow['type'], string> = {
  book_published: 'published',
  chapter_posted: 'posted a new chapter',
  book_liked: 'liked',
  book_commented: 'commented on',
  spark_entry_submitted: 'entered the Spark',
  spark_won_community: 'won the community vote for the Spark',
  spark_won_creator_choice: "was picked as the creator's choice for the Spark",
  hive_created: 'started a new hive',
  hive_joined: 'joined the hive',
  reading_list_created: 'created a list',
  books_added_batch: 'added books to a reading list',
  book_club_created: 'started a book club',
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
      return `/${locale}/reading-lists/${subject.id}`
    case 'book_club':
      return `/${locale}/clubs/${subject.id}`
    default:
      return null
  }
}

export function ActivityEventRow({ row, locale }: { row: FeedRow; locale: string }) {
  const handle = row.actor.username ? `@${row.actor.username}` : row.actor.displayName ?? 'Someone'
  const initial = (row.actor.username ?? row.actor.displayName ?? '?')[0]?.toUpperCase() ?? '?'
  const href = subjectHref(row, locale)
  const italicizeSubject = row.subject?.type === 'book' || row.subject?.type === 'chapter'

  // books_added_batch renders count-aware copy with payload.listTitle preferred
  // over subject.title. Bold list title, link if href resolvable.
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
    // payload: { name }; subject hydrated to club name. Prefer subject (live),
    // fall back to payload snapshot.
    const payload = row.payload ?? {}
    const rawName = (payload as { name?: unknown }).name
    const payloadName = typeof rawName === 'string' && rawName.length > 0 ? rawName : null
    verb = 'started a book club'
    subjectTitle = row.subject?.title ?? payloadName
  } else if (row.type === 'book_club_current_book_changed') {
    // payload: { clubName, fromBookTitle, toBookTitle }. The meaningful subject
    // here is the NEW book the club is reading. Use the club name (subject) in
    // the verb so the bold subjectTitle is the book.
    const payload = row.payload ?? {}
    const rawClub = (payload as { clubName?: unknown }).clubName
    const rawTo = (payload as { toBookTitle?: unknown }).toBookTitle
    const clubName = typeof rawClub === 'string' && rawClub.length > 0
      ? rawClub
      : row.subject?.title ?? null
    const toBookTitle = typeof rawTo === 'string' && rawTo.length > 0 ? rawTo : null
    verb = clubName ? `'s club ${clubName} is now reading` : 'is now reading'
    subjectTitle = toBookTitle
  } else {
    verb = VERB[row.type] ?? 'made an update'
    subjectTitle = row.subject?.title ?? null
  }

  // For reading_list_created + books_added_batch + book_club_* we want bold
  // subject title (not italic). Other types keep the italic-book-title treatment.
  const boldSubject =
    row.type === 'reading_list_created' ||
    row.type === 'books_added_batch' ||
    row.type === 'book_club_created' ||
    row.type === 'book_club_current_book_changed'

  const subjectNode = (() => {
    if (!subjectTitle) {
      return <span style={{ color: 'var(--canvas-dark-ink-muted)' }}>[subject]</span>
    }
    const inner = boldSubject ? (
      <strong>{subjectTitle}</strong>
    ) : italicizeSubject ? (
      <em>{subjectTitle}</em>
    ) : (
      <span>{subjectTitle}</span>
    )
    if (href) {
      return (
        <Link
          href={href}
          style={{ color: 'var(--canvas-dark-ink-strong)' }}
          className="hover:underline"
        >
          {inner}
        </Link>
      )
    }
    return <span style={{ color: 'var(--canvas-dark-ink-strong)' }}>{inner}</span>
  })()

  return (
    <article
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        border: 'var(--br-card)',
        borderLeft: row.isFriend ? '2px solid var(--brand)' : undefined,
      }}
      className="flex gap-3 p-4"
    >
      {row.actor.username ? (
        <Link href={`/${locale}/u/${row.actor.username}`} className="shrink-0">
          {row.actor.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.actor.avatarUrl}
              alt=""
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <span
              style={{
                background: 'oklch(from var(--brand) l c h / 0.18)',
                border: '1px solid oklch(from var(--brand) l c h / 0.3)',
                color: 'var(--brand)',
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
            >
              {initial}
            </span>
          )}
        </Link>
      ) : (
        <span
          style={{
            background: 'oklch(from var(--brand) l c h / 0.18)',
            border: '1px solid oklch(from var(--brand) l c h / 0.3)',
            color: 'var(--brand)',
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
        >
          {initial}
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <p style={{ color: 'var(--canvas-dark-ink)' }} className="text-sm leading-snug">
            {row.actor.username ? (
              <Link
                href={`/${locale}/u/${row.actor.username}`}
                style={{ color: 'var(--canvas-dark-ink-strong)' }}
                className="font-semibold hover:underline"
              >
                {handle}
              </Link>
            ) : (
              <span style={{ color: 'var(--canvas-dark-ink-strong)' }} className="font-semibold">
                {handle}
              </span>
            )}{' '}
            <span style={{ color: 'var(--canvas-dark-ink-muted)' }}>{verb}</span>{' '}
            {subjectNode}
          </p>
          <span
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
            className="shrink-0 font-mono text-[10px] uppercase tracking-wider"
          >
            {relTime(row.createdAt)}
          </span>
        </div>

        {row.subject?.coverUrl &&
        (row.subject.type === 'book' || row.subject.type === 'chapter') ? (
          <div className="flex">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={row.subject.coverUrl}
              alt=""
              style={{
                borderRadius: 'var(--r-row)',
                boxShadow: 'var(--sh-tile)',
              }}
              className="h-16 w-12 object-cover"
            />
          </div>
        ) : null}
      </div>
    </article>
  )
}
