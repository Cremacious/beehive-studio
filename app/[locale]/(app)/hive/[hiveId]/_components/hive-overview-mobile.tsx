import Link from 'next/link'
import { ArrowLeft, BookOpen, ExternalLink, Users } from 'lucide-react'
import { optimizeCloudinaryUrl, BOOK_COVER_TRANSFORMS } from '@/lib/upload/cloudinary-url'
import { HiveDashboardActivitySection } from './hive-dashboard-activity-section'
import type { HiveActivityEvent } from '@/lib/actions/hive-activity.actions'

// Mobile-only hive overview (issue #50, variant A — stacked cards). Desktop
// renders the HivePageShell layout unchanged; this component is shown via
// `md:hidden` from the page. Three calm cards: hive info, linked book,
// recent activity.

const CARD = {
  background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
  borderRadius: 'var(--r-card)',
  border: 'var(--br-card)',
  boxShadow: 'var(--sh-card)',
} as const

function relTime(d: Date): string {
  const seconds = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

type Props = {
  locale: string
  hiveId: string
  hiveName: string
  description: string | null
  memberCount: number
  lastActive: Date | null
  book: { id: string; title: string; coverUrl: string | null; authorUsername: string | null } | null
  isShadow: boolean
  isAuthor: boolean
  activityEvents: HiveActivityEvent[]
}

export function HiveOverviewMobile({
  locale,
  hiveId,
  hiveName,
  description,
  memberCount,
  lastActive,
  book,
  isShadow,
  isAuthor,
  activityEvents,
}: Props) {
  return (
    <div className="flex flex-col gap-3 pt-3 pb-6">
      <Link
        href={`/${locale}/community/hives`}
        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider w-fit"
        style={{ color: 'var(--canvas-dark-ink-muted)' }}
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to hives
      </Link>

      {/* Card 1 — hive info */}
      <div style={CARD} className="p-4">
        <h1
          className="font-comfortaa font-bold text-[20px] leading-tight"
          style={{ color: 'var(--brand)' }}
        >
          {hiveName}
        </h1>
        {description && (
          <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
            {description}
          </p>
        )}
        <div
          className="flex items-center gap-3 mt-3 text-[11px] font-mono"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          <span className="inline-flex items-center gap-1.5">
            <Users className="w-3 h-3" />
            {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </span>
          <span>·</span>
          <span>Active {lastActive ? relTime(lastActive) : '–'}</span>
        </div>
      </div>

      {/* Card 2 — linked book / standalone */}
      {book && !isShadow ? (
        <div style={CARD} className="p-4">
          <div className="flex gap-3.5">
            {book.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={optimizeCloudinaryUrl(book.coverUrl, BOOK_COVER_TRANSFORMS)}
                alt={book.title}
                className="w-16 h-[88px] object-cover rounded-md border border-border shrink-0"
              />
            ) : (
              <div className="w-16 h-[88px] rounded-md border border-border bg-muted flex items-center justify-center shrink-0">
                <BookOpen className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <h2 className="font-comfortaa font-bold text-[16px] leading-tight" style={{ color: 'var(--brand)' }}>
                {book.title}
              </h2>
              {book.authorUsername && (
                <p className="text-[11px] mt-1" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                  by @{book.authorUsername}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 mt-3.5">
            <Link
              href={`/${locale}/books/${book.id}`}
              className="flex w-full items-center justify-center gap-1.5 min-h-[42px] rounded-[var(--r-pill)] text-[13px] font-bold no-underline"
              style={{ background: 'var(--brand)', color: 'var(--brand-ink)', boxShadow: 'var(--sh-tile)' }}
            >
              <BookOpen className="w-4 h-4" />
              Read the book
            </Link>
            {isAuthor && (
              <Link
                href={`/${locale}/studio/${book.id}`}
                className="flex w-full items-center justify-center gap-1.5 min-h-[42px] rounded-[var(--r-pill)] text-[13px] font-semibold no-underline"
                style={{
                  background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                  border: 'var(--br-card)',
                  boxShadow: 'var(--sh-tile)',
                  color: 'var(--canvas-dark-ink-strong)',
                }}
              >
                <ExternalLink className="w-4 h-4" />
                Open in studio
              </Link>
            )}
          </div>
        </div>
      ) : isShadow ? (
        <div style={CARD} className="p-4">
          <p className="text-[13px]" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
            No book linked to this hive.
          </p>
        </div>
      ) : null}

      {/* Card 3 — recent activity */}
      <div style={CARD} className="overflow-hidden">
        <HiveDashboardActivitySection events={activityEvents} hiveId={hiveId} locale={locale} />
      </div>
    </div>
  )
}
