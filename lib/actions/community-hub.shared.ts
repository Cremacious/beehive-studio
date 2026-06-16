// Sibling shared module for community-hub action types + constants.
// REASON: `'use server'` modules can only export async functions. Object
// constants and pure helpers must live in a sibling non-'use server' module.
// (Documented in AGENTS.md "Patterns" section — same precedent as
// lib/actions/discover-shared.ts and discover-lists-shared.ts.)

export type HivePanelData = {
  pendingReviewCount: number
  pendingReviewHiveName: string | null
  pendingReviewHiveId: string | null
  wordGoalHiveName: string | null
  wordGoalHiveId: string | null
  wordGoalPct: number | null
  wordGoalDaysLeft: number | null
  staleHiveName: string | null
  staleHiveId: string | null
  staleDaysSinceActivity: number | null
}

export type SparksPanelData = {
  votingEndingTitle: string | null
  votingEndingId: string | null
  votingEndingHoursLeft: number | null
  awaitingResultCount: number
  openFromFollowedCount: number
  openFromFollowedAuthorUsername: string | null
}

export type ListsPanelData = {
  yourTrendingListName: string | null
  yourTrendingListId: string | null
  yourTrendingFollowerGain: number | null
  newFromFollowedListTitle: string | null
  newFromFollowedListId: string | null
  newFromFollowedAuthorUsername: string | null
  booksAddedListName: string | null
  booksAddedListId: string | null
  booksAddedCount: number | null
}

export type ClubsPanelData = {
  currentBookClubName: string | null
  currentBookClubId: string | null
  currentBookTitle: string | null
  unreadRepliesCount: number
  pendingInviteClubName: string | null
  pendingInviteClubId: string | null
  pendingInviteInviterUsername: string | null
}

export type FriendsPanelData = {
  pendingRequestsCount: number
  milestoneUsername: string | null
  milestoneType: 'first_book' | 'spark_win' | null
  suggestionsCount: number
}

export type FallbackNudges = {
  // Activity-feed empty-state cards (all from the discoverable pool).
  todaysSparkTitle: string | null
  todaysSparkId: string | null
  todaysSparkEntryCount: number
  openClubName: string | null
  openClubId: string | null
  openClubCurrentBookTitle: string | null
  suggestedWriterCount: number
  // Per-panel discover-pool counts for empty-state nudges.
  openHivesCount: number  // discoverable hives accepting members
  openSparksCount: number // OPEN status, discoverable
  trendingListName: string | null
  trendingListId: string | null
  trendingListFollowerGain: number | null
  openClubsCount: number  // discoverable + openJoin
}

export type CommunityHighlights = {
  hives: HivePanelData
  sparks: SparksPanelData
  lists: ListsPanelData
  clubs: ClubsPanelData
  friends: FriendsPanelData
  fallbacks: FallbackNudges
}

export const EMPTY_FALLBACKS: FallbackNudges = {
  todaysSparkTitle: null,
  todaysSparkId: null,
  todaysSparkEntryCount: 0,
  openClubName: null,
  openClubId: null,
  openClubCurrentBookTitle: null,
  suggestedWriterCount: 0,
  openHivesCount: 0,
  openSparksCount: 0,
  trendingListName: null,
  trendingListId: null,
  trendingListFollowerGain: null,
  openClubsCount: 0,
}

export const EMPTY_HIGHLIGHTS: CommunityHighlights = {
  hives: {
    pendingReviewCount: 0,
    pendingReviewHiveName: null,
    pendingReviewHiveId: null,
    wordGoalHiveName: null,
    wordGoalHiveId: null,
    wordGoalPct: null,
    wordGoalDaysLeft: null,
    staleHiveName: null,
    staleHiveId: null,
    staleDaysSinceActivity: null,
  },
  sparks: {
    votingEndingTitle: null,
    votingEndingId: null,
    votingEndingHoursLeft: null,
    awaitingResultCount: 0,
    openFromFollowedCount: 0,
    openFromFollowedAuthorUsername: null,
  },
  lists: {
    yourTrendingListName: null,
    yourTrendingListId: null,
    yourTrendingFollowerGain: null,
    newFromFollowedListTitle: null,
    newFromFollowedListId: null,
    newFromFollowedAuthorUsername: null,
    booksAddedListName: null,
    booksAddedListId: null,
    booksAddedCount: null,
  },
  clubs: {
    currentBookClubName: null,
    currentBookClubId: null,
    currentBookTitle: null,
    unreadRepliesCount: 0,
    pendingInviteClubName: null,
    pendingInviteClubId: null,
    pendingInviteInviterUsername: null,
  },
  friends: {
    pendingRequestsCount: 0,
    milestoneUsername: null,
    milestoneType: null,
    suggestionsCount: 0,
  },
  fallbacks: EMPTY_FALLBACKS,
}
