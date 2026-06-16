'use server'

import { requireAuth, AuthError } from '@/lib/require-auth'
import {
  getUserHivesView,
  type UserHiveView,
} from './hive.actions'
import {
  getSuggestedHivesAction,
  type SuggestedHive,
} from './hives-suggested.actions'

export type CommunityHivesTab = 'all' | 'yours' | 'member' | 'suggested'
export type CommunityHivesSort = 'active' | 'newest' | 'a-z' | 'members'
export type CommunityHiveSource = 'yours' | 'member' | 'suggested'

export type CommunityHiveRow = {
  id: string
  name: string
  description: string | null
  bookId: string | null
  bookTitle: string | null
  bookCoverUrl: string | null
  visibility: 'PRIVATE' | 'FRIENDS' | 'PUBLIC'
  discoverable: boolean
  status: 'ACTIVE' | 'COMPLETED'
  memberCount: number
  memberPreviews: Array<{ userId: string; avatarUrl: string | null }>
  lastActiveAt: Date | null
  createdAt: Date | null
  viewerRole: 'OWNER' | 'MODERATOR' | 'CONTRIBUTOR' | 'BETA_READER' | null
  source: CommunityHiveSource
  suggestionReason: string | null
}

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

const PAGE_SIZE = 9
const ALL_TAB_BUCKET_CAP = PAGE_SIZE * 6 // 54
const SINGLE_BUCKET_CAP = PAGE_SIZE * 14 // 126

/**
 * Hives Hub canonical query. Aggregates `getUserHivesView` (member-hives,
 * with viewerRole) and `getSuggestedHivesAction` (3-tier ranked
 * friend > FoF > trending suggestions, viewer-not-in already filtered
 * server-side) into a 4-bucket source-tagged stream:
 *   yours     — viewer is OWNER
 *   member    — viewer is non-OWNER member
 *   suggested — recommended hive the viewer is NOT in (with reason)
 */
export async function getCommunityHivesAction(input: {
  tab: CommunityHivesTab
  sort: CommunityHivesSort
  page: number
}): Promise<
  ActionResult<{
    hives: CommunityHiveRow[]
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

  // Fetch both sources in parallel. `getSuggestedHivesAction` already
  // excludes hives the viewer is in (Tier queries embed the exclusion),
  // so no post-fetch viewerHiveIds filter is needed.
  const [viewerR, suggestedR] = await Promise.all([
    getUserHivesView(),
    getSuggestedHivesAction({ limit: SINGLE_BUCKET_CAP }),
  ])

  if (!viewerR.success) return { success: false, error: viewerR.error }

  const viewerHives = viewerR.data
  const suggestedHives: SuggestedHive[] = suggestedR.success
    ? suggestedR.data
    : []

  // Convert viewer hives to CommunityHiveRow with source = yours/member.
  const yoursRows: CommunityHiveRow[] = viewerHives
    .filter((h) => h.viewerRole === 'OWNER')
    .map((h) => toCommunityRow(h, 'yours'))
  const memberRows: CommunityHiveRow[] = viewerHives
    .filter((h) => h.viewerRole !== 'OWNER')
    .map((h) => toCommunityRow(h, 'member'))
  const suggestedRows: CommunityHiveRow[] = suggestedHives.map((h) =>
    suggestedHiveToRow(h),
  )

  const bucketCounts = {
    all: yoursRows.length + memberRows.length + suggestedRows.length,
    yours: yoursRows.length,
    member: memberRows.length,
    suggested: suggestedRows.length,
  }

  let pool: CommunityHiveRow[]
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

  // Sort.
  pool.sort(makeComparator(input.sort))

  const totalCount = pool.length
  const page = Math.max(1, input.page)
  const start = (page - 1) * PAGE_SIZE
  const hives = pool.slice(start, start + PAGE_SIZE)

  return { success: true, data: { hives, totalCount, bucketCounts } }
}

function toCommunityRow(
  h: UserHiveView,
  source: CommunityHiveSource,
): CommunityHiveRow {
  return {
    id: h.id,
    name: h.name,
    description: h.description,
    bookId: h.bookId,
    bookTitle: h.bookTitle,
    bookCoverUrl: h.bookCoverUrl,
    visibility: h.visibility,
    discoverable: h.discoverable,
    status: h.status,
    memberCount: h.memberCount,
    memberPreviews: h.memberPreviews,
    lastActiveAt: h.lastActiveAt,
    // viewer view doesn't carry createdAt; 'newest' sort falls back to 0
    // for these rows. Sort by 'active' for richer ordering on member-hives.
    createdAt: null,
    viewerRole: h.viewerRole,
    source,
    suggestionReason: null,
  }
}

function suggestedHiveToRow(h: SuggestedHive): CommunityHiveRow {
  // SuggestedHive = HiveSummary & { lastActiveAt, suggestionReason }.
  // HiveSummary (post-T1 widening) carries bookTitle, bookCoverUrl, real
  // memberCount, and memberPreviews — no more null/0 placeholders.
  return {
    id: h.id,
    name: h.name,
    description: h.description,
    bookId: h.bookId,
    bookTitle: h.bookTitle,
    bookCoverUrl: h.bookCoverUrl,
    visibility: h.visibility,
    discoverable: true,
    status: h.status,
    memberCount: h.memberCount,
    memberPreviews: h.memberPreviews,
    lastActiveAt: h.lastActiveAt,
    createdAt: h.createdAt,
    viewerRole: null,
    source: 'suggested',
    suggestionReason: h.suggestionReason,
  }
}

function makeComparator(sort: CommunityHivesSort) {
  return (a: CommunityHiveRow, b: CommunityHiveRow) => {
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
