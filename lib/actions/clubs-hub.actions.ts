'use server'

import { requireAuth, AuthError } from '@/lib/require-auth'
import { getClubsAction, type ClubSummary } from './book-clubs.actions'
import {
  getSuggestedClubsAction,
  type SuggestedClub,
} from './clubs-suggested.actions'

export type CommunityClubsTab = 'all' | 'yours' | 'member' | 'suggested'
export type CommunityClubsSort = 'active' | 'newest' | 'a-z' | 'members'
export type CommunityClubSource = 'yours' | 'member' | 'suggested'

export type CommunityClubRow = {
  id: string
  name: string
  description: string | null
  coverImageUrl: string | null
  currentBookId: string | null
  currentBookTitle: string | null
  visibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE'
  openJoin: boolean
  memberCount: number
  memberPreviews: Array<{ userId: string; avatarUrl: string | null }>
  lastActiveAt: Date | null
  createdAt: Date | null
  viewerRole: 'OWNER' | 'MODERATOR' | 'MEMBER' | null
  source: CommunityClubSource
  suggestionReason: string | null
}

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

const PAGE_SIZE = 9
const ALL_TAB_BUCKET_CAP = PAGE_SIZE * 6 // 54
const SINGLE_BUCKET_CAP = PAGE_SIZE * 14 // 126

/**
 * Clubs Hub canonical query. Aggregates `getClubsAction({filter:'mine'})`
 * (viewer's clubs with viewerMembership.role) and `getSuggestedClubsAction`
 * (3-tier ranked friend > FoF > trending) into a 4-bucket source-tagged
 * stream:
 *   yours     — viewer is OWNER
 *   member    — viewer is non-OWNER member (MODERATOR or MEMBER)
 *   suggested — recommended club the viewer is NOT in (with reason)
 */
export async function getCommunityClubsAction(input: {
  tab: CommunityClubsTab
  sort: CommunityClubsSort
  page: number
}): Promise<
  ActionResult<{
    clubs: CommunityClubRow[]
    totalCount: number
    bucketCounts: {
      all: number
      yours: number
      member: number
      suggested: number
    }
  }>
> {
  try {
    await requireAuth()
  } catch (e) {
    if (e instanceof AuthError) return { success: false, error: 'UNAUTHORIZED' }
    throw e
  }

  // Fetch both sources in parallel. `getSuggestedClubsAction` already
  // excludes clubs the viewer is in.
  const [mineR, suggestedR] = await Promise.all([
    getClubsAction({ filter: 'mine', limit: SINGLE_BUCKET_CAP }),
    getSuggestedClubsAction({ limit: SINGLE_BUCKET_CAP }),
  ])

  if (!mineR.success) return { success: false, error: mineR.error }

  const mineRows = mineR.data.rows
  const suggestedClubs: SuggestedClub[] = suggestedR.success
    ? suggestedR.data
    : []

  // Split mine into yours (OWNER) + member (else) and map to CommunityClubRow.
  const yoursRows: CommunityClubRow[] = mineRows
    .filter((c) => c.viewerMembership?.role === 'OWNER')
    .map((c) => clubSummaryToRow(c, 'yours'))
  const memberRows: CommunityClubRow[] = mineRows
    .filter(
      (c) =>
        c.viewerMembership?.role !== null &&
        c.viewerMembership?.role !== undefined &&
        c.viewerMembership.role !== 'OWNER',
    )
    .map((c) => clubSummaryToRow(c, 'member'))
  const suggestedRows: CommunityClubRow[] = suggestedClubs.map((c) =>
    suggestedClubToRow(c),
  )

  const bucketCounts = {
    all: yoursRows.length + memberRows.length + suggestedRows.length,
    yours: yoursRows.length,
    member: memberRows.length,
    suggested: suggestedRows.length,
  }

  let pool: CommunityClubRow[]
  switch (input.tab) {
    case 'yours':
      pool = yoursRows.slice(0, SINGLE_BUCKET_CAP)
      break
    case 'member':
      pool = memberRows.slice(0, SINGLE_BUCKET_CAP)
      break
    case 'suggested':
      pool = suggestedRows.slice(0, SINGLE_BUCKET_CAP)
      break
    case 'all':
    default:
      pool = [...yoursRows, ...memberRows, ...suggestedRows].slice(
        0,
        ALL_TAB_BUCKET_CAP,
      )
      break
  }

  pool.sort(makeComparator(input.sort))

  const totalCount = pool.length
  const page = Math.max(1, input.page)
  const start = (page - 1) * PAGE_SIZE
  const clubs = pool.slice(start, start + PAGE_SIZE)

  return { success: true, data: { clubs, totalCount, bucketCounts } }
}

function clubSummaryToRow(
  c: ClubSummary,
  source: CommunityClubSource,
): CommunityClubRow {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    coverImageUrl: c.coverImageUrl,
    currentBookId: c.currentBook?.id ?? null,
    currentBookTitle: c.currentBook?.title ?? null,
    visibility: c.visibility,
    openJoin: c.openJoin,
    memberCount: c.memberCount,
    memberPreviews: c.memberPreviews,
    lastActiveAt: c.lastActivityAt,
    createdAt: c.createdAt,
    viewerRole: c.viewerMembership?.role ?? null,
    source,
    suggestionReason: null,
  }
}

function suggestedClubToRow(c: SuggestedClub): CommunityClubRow {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    coverImageUrl: c.coverImageUrl,
    currentBookId: c.currentBookId,
    currentBookTitle: c.currentBookTitle,
    visibility: c.visibility,
    openJoin: c.openJoin,
    memberCount: c.memberCount,
    memberPreviews: c.memberPreviews,
    lastActiveAt: c.lastActivityAt,
    createdAt: c.createdAt,
    viewerRole: null,
    source: 'suggested',
    suggestionReason: c.suggestionReason,
  }
}

function makeComparator(sort: CommunityClubsSort) {
  return (a: CommunityClubRow, b: CommunityClubRow) => {
    switch (sort) {
      case 'active': {
        const aT = a.lastActiveAt?.getTime() ?? 0
        const bT = b.lastActiveAt?.getTime() ?? 0
        return bT - aT
      }
      case 'newest': {
        const aT = a.createdAt?.getTime() ?? 0
        const bT = b.createdAt?.getTime() ?? 0
        return bT - aT
      }
      case 'a-z':
        return a.name.localeCompare(b.name)
      case 'members':
        return b.memberCount - a.memberCount
    }
  }
}
