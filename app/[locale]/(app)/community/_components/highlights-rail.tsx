import Link from 'next/link'
import {
  ChevronRight,
  Hexagon,
  Zap,
  BookOpen,
  BookMarked,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type {
  CommunityHighlights,
  HivePanelData,
  SparksPanelData,
  ListsPanelData,
  ClubsPanelData,
  FriendsPanelData,
} from '@/lib/actions/community-hub.actions'

// ─── Shared chrome ────────────────────────────────────────────────────────────

type HighlightRow = {
  tag: string
  body: React.ReactNode
}

function HighlightPanel({
  icon: Icon,
  label,
  href,
  rows,
  emptyMessage,
  emptyHref,
  ariaLabel,
}: {
  icon: LucideIcon
  label: string
  href: string
  rows: HighlightRow[]
  emptyMessage: string
  emptyHref: string
  ariaLabel: string
}) {
  return (
    <section
      aria-label={ariaLabel}
      className="flex-1 min-h-0 flex flex-col rounded-[var(--r-row)] border border-[var(--br-card)] overflow-hidden"
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        boxShadow: 'var(--sh-tile)',
      }}
    >
      <Link
        href={href}
        className="flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[var(--brand)]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand)] font-[family-name:var(--font-display)]">
            {label}
          </span>
        </div>
        <ChevronRight className="h-4 w-4 text-[var(--brand)]/70" />
      </Link>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-2">
        {rows.length === 0 ? (
          <Link
            href={emptyHref}
            className="block py-2 text-xs italic text-[var(--canvas-dark-ink-muted)] hover:text-[var(--canvas-dark-ink)]"
          >
            {emptyMessage}{' '}
            <span className="text-[var(--brand)] not-italic">→</span>
          </Link>
        ) : (
          rows.map((row, i) => (
            <div
              key={i}
              className="py-2 border-t border-white/[0.04] first:border-t-0"
            >
              <div className="text-[8px] font-mono uppercase tracking-wider text-[var(--brand)]/80">
                {row.tag}
              </div>
              <div className="text-xs text-[var(--canvas-dark-ink)] line-clamp-2 mt-0.5">
                {row.body}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

// ─── Per-category panel builders ──────────────────────────────────────────────

function buildHiveRows(data: HivePanelData): HighlightRow[] {
  const rows: HighlightRow[] = []
  if (data.pendingReviewCount > 0 && data.pendingReviewHiveName) {
    rows.push({
      tag: 'Needs review',
      body: `${data.pendingReviewCount} pending in ${data.pendingReviewHiveName}`,
    })
  }
  if (data.wordGoalHiveName && data.wordGoalPct !== null) {
    const left =
      data.wordGoalDaysLeft !== null
        ? ` · ${data.wordGoalDaysLeft}d left`
        : ''
    rows.push({
      tag: 'Word goal',
      body: `${data.wordGoalHiveName}: ${data.wordGoalPct}%${left}`,
    })
  }
  if (data.staleHiveName && data.staleDaysSinceActivity !== null) {
    rows.push({
      tag: 'Quiet',
      body: `${data.staleHiveName}: no activity for ${data.staleDaysSinceActivity}d`,
    })
  }
  return rows
}

function buildSparkRows(data: SparksPanelData): HighlightRow[] {
  const rows: HighlightRow[] = []
  if (data.votingEndingTitle && data.votingEndingHoursLeft !== null) {
    rows.push({
      tag: 'Voting',
      body: `'${data.votingEndingTitle}' voting ends in ${data.votingEndingHoursLeft}h`,
    })
  }
  if (data.awaitingResultCount > 0) {
    rows.push({
      tag: 'Awaiting',
      body: `${data.awaitingResultCount} entered, awaiting decision`,
    })
  }
  if (data.openFromFollowedCount > 0 && data.openFromFollowedAuthorUsername) {
    rows.push({
      tag: 'Open',
      body: `@${data.openFromFollowedAuthorUsername} just posted a new prompt`,
    })
  }
  return rows
}

function buildListRows(data: ListsPanelData): HighlightRow[] {
  const rows: HighlightRow[] = []
  if (data.yourTrendingListName && data.yourTrendingFollowerGain !== null) {
    rows.push({
      tag: 'Trending',
      body: `${data.yourTrendingListName} +${data.yourTrendingFollowerGain} followers this week`,
    })
  }
  if (data.newFromFollowedListTitle && data.newFromFollowedAuthorUsername) {
    rows.push({
      tag: 'New',
      body: `@${data.newFromFollowedAuthorUsername} published '${data.newFromFollowedListTitle}'`,
    })
  }
  if (data.booksAddedListName && data.booksAddedCount !== null) {
    rows.push({
      tag: 'Updated',
      body: `${data.booksAddedListName} got ${data.booksAddedCount} new ${data.booksAddedCount === 1 ? 'book' : 'books'}`,
    })
  }
  return rows
}

function buildClubRows(data: ClubsPanelData): HighlightRow[] {
  const rows: HighlightRow[] = []
  if (data.currentBookClubName && data.currentBookTitle) {
    rows.push({
      tag: 'Current book',
      body: `${data.currentBookClubName}: ${data.currentBookTitle}`,
    })
  }
  if (data.unreadRepliesCount > 0) {
    const display =
      data.unreadRepliesCount >= 99 ? '99+' : String(data.unreadRepliesCount)
    rows.push({
      tag: 'Discussion',
      body: `${display} new ${data.unreadRepliesCount === 1 ? 'reply' : 'replies'} in your club`,
    })
  }
  if (data.pendingInviteClubName && data.pendingInviteInviterUsername) {
    rows.push({
      tag: 'Invite',
      body: `@${data.pendingInviteInviterUsername} invited you to ${data.pendingInviteClubName}`,
    })
  }
  return rows
}

function buildFriendsRows(data: FriendsPanelData): HighlightRow[] {
  const rows: HighlightRow[] = []
  if (data.pendingRequestsCount > 0) {
    rows.push({
      tag: 'Pending',
      body: `${data.pendingRequestsCount} friend ${data.pendingRequestsCount === 1 ? 'request' : 'requests'}`,
    })
  }
  if (data.milestoneUsername && data.milestoneType) {
    const verb =
      data.milestoneType === 'first_book'
        ? 'published a new book'
        : 'won a Spark'
    rows.push({
      tag: 'Milestone',
      body: `@${data.milestoneUsername} ${verb}`,
    })
  }
  if (data.suggestionsCount > 0) {
    rows.push({
      tag: 'Suggested',
      body: `${data.suggestionsCount} new writers to follow`,
    })
  }
  return rows
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export function HighlightsRail({
  highlights,
  locale,
}: {
  highlights: CommunityHighlights
  locale: string
}) {
  return (
    <div className="flex flex-col gap-2 h-full">
      <HighlightPanel
        ariaLabel="Hives highlights"
        icon={Hexagon}
        label="Hives"
        href={`/${locale}/hives`}
        rows={buildHiveRows(highlights.hives)}
        emptyMessage="No hives yet · Create one"
        emptyHref={`/${locale}/studio`}
      />
      <HighlightPanel
        ariaLabel="Sparks highlights"
        icon={Zap}
        label="Sparks"
        href={`/${locale}/sparks`}
        rows={buildSparkRows(highlights.sparks)}
        emptyMessage="Today's prompt is waiting"
        emptyHref={`/${locale}/sparks`}
      />
      <HighlightPanel
        ariaLabel="Reading lists highlights"
        icon={BookOpen}
        label="Lists"
        href={`/${locale}/reading-lists`}
        rows={buildListRows(highlights.lists)}
        emptyMessage="Build your first list"
        emptyHref={`/${locale}/reading-lists`}
      />
      <HighlightPanel
        ariaLabel="Book clubs highlights"
        icon={BookMarked}
        label="Clubs"
        href={`/${locale}/clubs`}
        rows={buildClubRows(highlights.clubs)}
        emptyMessage="Discover open clubs"
        emptyHref={`/${locale}/discover?tab=clubs`}
      />
      <HighlightPanel
        ariaLabel="Friends highlights"
        icon={Users}
        label="Friends"
        href={`/${locale}/friends`}
        rows={buildFriendsRows(highlights.friends)}
        emptyMessage="Invite a friend"
        emptyHref={`/${locale}/friends?tab=find`}
      />
    </div>
  )
}
