'use server'

import {
  searchBooksDiscoverAction,
  type BookCard,
} from './discover.actions'
import {
  searchSparksDiscoverAction,
  type SparkCard,
} from './discover-sparks.actions'
import {
  searchHivesDiscoverAction,
  type HiveCard,
} from './discover-hives.actions'
import {
  searchListsDiscoverAction,
  type ListCard,
} from './discover-lists.actions'
import {
  searchClubsDiscoverAction,
  type ClubCard,
} from './discover-clubs.actions'
import type { ActionResult } from './book.actions'

export type HomeMixedItem =
  | { kind: 'book'; data: BookCard }
  | { kind: 'spark'; data: SparkCard }
  | { kind: 'hive'; data: HiveCard }
  | { kind: 'list'; data: ListCard }
  | { kind: 'club'; data: ClubCard }

export type EntityKind = 'books' | 'sparks' | 'hives' | 'lists' | 'clubs'

const PER_ENTITY = 6

/**
 * Cross-entity discovery search. Fans out to all 5 entity search actions
 * scoped to the checked entities, interleaves their results round-robin
 * (B, S, H, L, C, B, S, H, L, C, …) per the D4 / W6 spec.
 *
 * Featured source: first entity (in priority order Books → Sparks → Hives →
 * Lists → Clubs) that has a current featured qualifier is used for the slim
 * featured strip on Home.
 *
 * v1 has no cursor pagination — the page reads the top ~30 items (6 × 5)
 * and ships. Cursor support is a deferred follow-up.
 */
export async function searchHomeMixedAction(args: {
  q?: string
  show?: EntityKind[]
  genres?: string[]
  /** Multi-tag filter — only meaningful for the Lists section (issue #22). */
  tags?: string[]
  from?: 'anyone' | 'following'
}): Promise<
  ActionResult<{ items: HomeMixedItem[]; totalCount: number }>
> {
  const showSet = new Set<EntityKind>(
    args.show && args.show.length > 0
      ? args.show
      : (['books', 'sparks', 'hives', 'lists', 'clubs'] as const),
  )
  const sharedGenres = args.genres ?? []
  const sharedTags = (args.tags ?? [])
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0)
  const q = args.q
  const fromFollowing = args.from === 'following'

  const [booksRes, sparksRes, hivesRes, listsRes, clubsRes] = await Promise.all([
    showSet.has('books')
      ? searchBooksDiscoverAction({
          q,
          genres: sharedGenres,
          sort: fromFollowing ? 'recent' : 'popular',
        })
      : Promise.resolve({
          success: true as const,
          data: { books: [] as BookCard[], nextCursor: null },
        }),
    showSet.has('sparks')
      ? searchSparksDiscoverAction({
          q,
          genres: sharedGenres,
          creator: fromFollowing ? 'following' : 'anyone',
          sort: 'urgent',
        })
      : Promise.resolve({
          success: true as const,
          data: { books: [] as SparkCard[], nextCursor: null },
        }),
    showSet.has('hives')
      ? searchHivesDiscoverAction({
          q,
          genres: sharedGenres,
          sort: 'most-active',
        })
      : Promise.resolve({
          success: true as const,
          data: { books: [] as HiveCard[], nextCursor: null },
        }),
    showSet.has('lists')
      ? searchListsDiscoverAction({
          q,
          genres: sharedGenres,
          tags: sharedTags.length > 0 ? sharedTags : undefined,
          curator: fromFollowing ? 'following' : 'anyone',
          sort: 'most-followed',
        })
      : Promise.resolve({
          success: true as const,
          data: { books: [] as ListCard[], nextCursor: null },
        }),
    showSet.has('clubs')
      ? searchClubsDiscoverAction({
          q,
          genres: sharedGenres,
          sort: 'most-active',
        })
      : Promise.resolve({
          success: true as const,
          data: { books: [] as ClubCard[], nextCursor: null },
        }),
  ])

  // Per-entity slices (up to PER_ENTITY each).
  const bookSlice: HomeMixedItem[] = booksRes.success
    ? booksRes.data.books
        .slice(0, PER_ENTITY)
        .map((b): HomeMixedItem => ({ kind: 'book', data: b }))
    : []
  const sparkSlice: HomeMixedItem[] = sparksRes.success
    ? sparksRes.data.books
        .slice(0, PER_ENTITY)
        .map((s): HomeMixedItem => ({ kind: 'spark', data: s }))
    : []
  const hiveSlice: HomeMixedItem[] = hivesRes.success
    ? hivesRes.data.books
        .slice(0, PER_ENTITY)
        .map((h): HomeMixedItem => ({ kind: 'hive', data: h }))
    : []
  const listSlice: HomeMixedItem[] = listsRes.success
    ? listsRes.data.books
        .slice(0, PER_ENTITY)
        .map((l): HomeMixedItem => ({ kind: 'list', data: l }))
    : []
  const clubSlice: HomeMixedItem[] = clubsRes.success
    ? clubsRes.data.books
        .slice(0, PER_ENTITY)
        .map((c): HomeMixedItem => ({ kind: 'club', data: c }))
    : []

  // Round-robin interleave (B, S, H, L, C, B, S, H, L, C, ...).
  const queues = [bookSlice, sparkSlice, hiveSlice, listSlice, clubSlice]
  const items: HomeMixedItem[] = []
  let active = queues.some((q) => q.length > 0)
  while (active) {
    active = false
    for (const queue of queues) {
      const next = queue.shift()
      if (next) {
        items.push(next)
        active = true
      }
    }
  }

  return {
    success: true,
    data: {
      items,
      totalCount: items.length,
    },
  }
}
