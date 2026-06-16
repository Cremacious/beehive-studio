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
  FallbackNudges,
} from '@/lib/actions/community-hub.shared'

// ─── Shared chrome ────────────────────────────────────────────────────────────

type HighlightRow = {
  tag: string
  body: React.ReactNode
}

type FallbackRow = {
  tag: string
  body: React.ReactNode
  cta: string
  href: string
}

function HighlightPanel({
  icon: Icon,
  label,
  href,
  rows,
  fallback,
  ariaLabel,
}: {
  icon: LucideIcon
  label: string
  href: string
  rows: HighlightRow[]
  fallback: FallbackRow
  ariaLabel: string
}) {
  return (
    <section
      aria-label={ariaLabel}
      className="flex-1 min-h-0 flex flex-col rounded-[14px] overflow-hidden"
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 6px rgba(0,0,0,0.3)',
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
            href={fallback.href}
            className="block py-2 group"
          >
            <div className="text-[8px] font-mono uppercase tracking-wider text-[var(--brand)]/70">
              {fallback.tag}
            </div>
            <div className="text-xs text-[var(--canvas-dark-ink)] line-clamp-2 mt-0.5">
              {fallback.body}
            </div>
            <div className="inline-flex items-center gap-1 mt-1.5 px-2 py-1 rounded-md text-[10px] text-[var(--brand)] group-hover:bg-[var(--brand)]/10"
                 style={{ background: 'rgba(255,195,0,0.06)' }}>
              {fallback.cta}
            </div>
          </Link>
        ) : (
          rows.map((row, i) => (
            <div
              key={i}
              className="py-2"
              style={{
                borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)',
              }}
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

// ─── Per-category row builders ────────────────────────────────────────────────

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
      data.wordGoalDaysLeft !== null ? ` · ${data.wordGoalDaysLeft}d left` : ''
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

// ─── Fallback builders (variant D: live nudges from discoverable pool) ───────

function hivesFallback(f: FallbackNudges, locale: string): FallbackRow {
  if (f.openHivesCount > 0) {
    return {
      tag: 'Open to join',
      body: `${f.openHivesCount} ${f.openHivesCount === 1 ? 'hive is' : 'hives are'} looking for writers`,
      cta: 'Browse →',
      href: `/${locale}/discover?tab=hives`,
    }
  }
  return {
    tag: 'Get started',
    body: 'Create your first hive to write with friends',
    cta: '＋ Create →',
    href: `/${locale}/studio`,
  }
}

function sparksFallback(f: FallbackNudges, locale: string): FallbackRow {
  if (f.openSparksCount > 0) {
    return {
      tag: 'Live now',
      body: `${f.openSparksCount} ${f.openSparksCount === 1 ? 'spark is' : 'sparks are'} accepting entries`,
      cta: 'See all →',
      href: `/${locale}/sparks`,
    }
  }
  return {
    tag: 'Try one',
    body: 'Start a writing prompt of your own',
    cta: '＋ New Spark →',
    href: `/${locale}/sparks/new`,
  }
}

function listsFallback(f: FallbackNudges, locale: string): FallbackRow {
  if (f.trendingListName && f.trendingListFollowerGain !== null) {
    return {
      tag: 'Trending',
      body: `"${f.trendingListName}" +${f.trendingListFollowerGain} followers this week`,
      cta: 'View →',
      href: f.trendingListId
        ? `/${locale}/reading-lists/${f.trendingListId}`
        : `/${locale}/reading-lists`,
    }
  }
  return {
    tag: 'Build one',
    body: 'Curate book recs to share with the community',
    cta: '＋ Start →',
    href: `/${locale}/reading-lists`,
  }
}

function clubsFallback(f: FallbackNudges, locale: string): FallbackRow {
  if (f.openClubsCount > 0) {
    return {
      tag: 'Open to join',
      body: `${f.openClubsCount} ${f.openClubsCount === 1 ? 'club is' : 'clubs are'} accepting members`,
      cta: 'Browse →',
      href: `/${locale}/discover?tab=clubs`,
    }
  }
  return {
    tag: 'Start one',
    body: 'Form a book club around your favorite genre',
    cta: '＋ Create →',
    href: `/${locale}/clubs`,
  }
}

function friendsFallback(f: FallbackNudges, locale: string): FallbackRow {
  if (f.suggestedWriterCount > 0) {
    return {
      tag: 'Suggested',
      body: `${f.suggestedWriterCount} new writers near your taste`,
      cta: 'See all →',
      href: `/${locale}/friends?tab=find`,
    }
  }
  return {
    tag: 'Invite',
    body: 'Bring a friend to write with',
    cta: 'Get link →',
    href: `/${locale}/friends?tab=find`,
  }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export function HighlightsRail({
  highlights,
  locale,
}: {
  highlights: CommunityHighlights
  locale: string
}) {
  const { fallbacks } = highlights
  return (
    <div className="flex flex-col gap-2 h-full">
      <HighlightPanel
        ariaLabel="Hives highlights"
        icon={Hexagon}
        label="Hives"
        href={`/${locale}/hives`}
        rows={buildHiveRows(highlights.hives)}
        fallback={hivesFallback(fallbacks, locale)}
      />
      <HighlightPanel
        ariaLabel="Sparks highlights"
        icon={Zap}
        label="Sparks"
        href={`/${locale}/sparks`}
        rows={buildSparkRows(highlights.sparks)}
        fallback={sparksFallback(fallbacks, locale)}
      />
      <HighlightPanel
        ariaLabel="Reading lists highlights"
        icon={BookOpen}
        label="Lists"
        href={`/${locale}/reading-lists`}
        rows={buildListRows(highlights.lists)}
        fallback={listsFallback(fallbacks, locale)}
      />
      <HighlightPanel
        ariaLabel="Book clubs highlights"
        icon={BookMarked}
        label="Clubs"
        href={`/${locale}/clubs`}
        rows={buildClubRows(highlights.clubs)}
        fallback={clubsFallback(fallbacks, locale)}
      />
      <HighlightPanel
        ariaLabel="Friends highlights"
        icon={Users}
        label="Friends"
        href={`/${locale}/friends`}
        rows={buildFriendsRows(highlights.friends)}
        fallback={friendsFallback(fallbacks, locale)}
      />
    </div>
  )
}
