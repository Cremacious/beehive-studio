'use server'

import { requireAuth, AuthError } from '@/lib/require-auth'
import {
  getUserHivesView,
  getDiscoverableHivesAction,
  type UserHiveView,
  type HiveSummary,
} from './hive.actions'

export type CommunityHivesTab = 'all' | 'yours' | 'member' | 'open'
export type CommunityHivesSort = 'active' | 'newest' | 'a-z' | 'members'
export type CommunityHiveSource = 'yours' | 'member' | 'open'

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
  lastActiveAt: Date | null
  createdAt: Date | null
  viewerRole: 'OWNER' | 'MODERATOR' | 'CONTRIBUTOR' | 'BETA_READER' | null
  source: CommunityHiveSource
}

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

const PAGE_SIZE = 9
const ALL_TAB_BUCKET_CAP = PAGE_SIZE * 6 // 54
const SINGLE_BUCKET_CAP = PAGE_SIZE * 14 // 126

/**
 * Hives Hub canonical query. Aggregates `getUserHivesView` (member-hives,
 * with viewerRole) and `getDiscoverableHivesAction` (public + discoverable
 * open hives) into a 4-bucket source-tagged stream:
 *   yours  — viewer is OWNER
 *   member — viewer is non-OWNER member
 *   open   — discoverable hive the viewer is NOT in
 *
 * NOTE: `HiveSummary` (from getDiscoverableHivesAction) does NOT carry
 * `bookTitle`/`bookCoverUrl` and hardcodes `memberCount: 0`. Open-bucket
 * rows therefore have null book denorm + 0 member count until that
 * projection is widened (deferred follow-up).
 */
export async function getCommunityHivesAction(input: {
  tab: CommunityHivesTab
  sort: CommunityHivesSort
  page: number
}): Promise<
  ActionResult<{
    hives: CommunityHiveRow[]
    totalCount: number
    bucketCounts: { all: number; yours: number; member: number; open: number }
  }>
> {
  try {
    await requireAuth()
  } catch (e) {
    if (e instanceof AuthError) return { success: false, error: 'UNAUTHORIZED' }
    throw e
  }

  // Fetch both sources in parallel.
  const [viewerR, openR] = await Promise.all([
    getUserHivesView(),
    getDiscoverableHivesAction(),
  ])

  if (!viewerR.success) return { success: false, error: viewerR.error }

  const viewerHives = viewerR.data
  const openHivesAll: HiveSummary[] = openR.success ? openR.data : []

  // Filter out open hives the viewer is already in.
  const viewerHiveIds = new Set(viewerHives.map((h) => h.id))
  const openHives = openHivesAll.filter((h) => !viewerHiveIds.has(h.id))

  // Convert viewer hives to CommunityHiveRow with source = yours/member.
  const yoursRows: CommunityHiveRow[] = viewerHives
    .filter((h) => h.viewerRole === 'OWNER')
    .map((h) => toCommunityRow(h, 'yours'))
  const memberRows: CommunityHiveRow[] = viewerHives
    .filter((h) => h.viewerRole !== 'OWNER')
    .map((h) => toCommunityRow(h, 'member'))
  const openRows: CommunityHiveRow[] = openHives.map((h) => openSummaryToRow(h))

  const bucketCounts = {
    all: yoursRows.length + memberRows.length + openRows.length,
    yours: yoursRows.length,
    member: memberRows.length,
    open: openRows.length,
  }

  let pool: CommunityHiveRow[]
  switch (input.tab) {
    case 'yours':
      pool = yoursRows.slice(0, SINGLE_BUCKET_CAP)
      break
    case 'member':
      pool = memberRows.slice(0, SINGLE_BUCKET_CAP)
      break
    case 'open':
      pool = openRows.slice(0, SINGLE_BUCKET_CAP)
      break
    case 'all':
    default:
      pool = [...yoursRows, ...memberRows, ...openRows].slice(
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
    lastActiveAt: h.lastActiveAt,
    // viewer view doesn't carry createdAt; 'newest' sort falls back to 0
    // for these rows. Sort by 'active' for richer ordering on member-hives.
    createdAt: null,
    viewerRole: h.viewerRole,
    source,
  }
}

function openSummaryToRow(h: HiveSummary): CommunityHiveRow {
  // HiveSummary shape (verified at lib/actions/hive.actions.ts:19): id,
  // bookId, name, description, visibility, status, ownerId, memberCount
  // (always 0 — denorm not populated by getDiscoverableHivesAction),
  // createdAt. `bookTitle`/`bookCoverUrl` are NOT projected so open rows
  // render with null book denorm until the action's SELECT is widened.
  return {
    id: h.id,
    name: h.name,
    description: h.description,
    bookId: h.bookId,
    bookTitle: null,
    bookCoverUrl: null,
    visibility: h.visibility,
    discoverable: true,
    status: h.status,
    memberCount: h.memberCount,
    lastActiveAt: null,
    createdAt: h.createdAt,
    viewerRole: null,
    source: 'open',
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
