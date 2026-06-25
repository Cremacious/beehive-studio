'use server'

import { createId } from '@paralleldrive/cuid2'
import { and, asc, desc, eq, gte, inArray, lt, ne, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  readingLists,
  readingListBooks,
  readingListFollows,
  socialActivity,
  type ReadingListKind,
} from '@/db/schema/social'
import { books, bookVisibilityEnum } from '@/db/schema/books'
import { userProfiles } from '@/db/schema/auth'
import { requireAuth, getOptionalUserId } from '@/lib/require-auth'
import { isBlocked } from '@/lib/social/is-blocked'
import {
  canViewList,
  canEditList,
  canFollowList,
} from '@/lib/reading-lists/predicates'
import { recordSocialActivityTx } from '@/lib/social/record-activity'
import { getLikedListBooks, type DerivedBookRow } from '@/lib/reading-lists/liked-list-books'
import { canReadBook } from '@/lib/books/can-read'
import { extractMentionUsernamesFromText } from '@/lib/mentions/extract-mentions'
import { resolveMentionedUsers } from '@/lib/mentions/resolve-mentions'
import { recordMentionNotificationsTx } from '@/lib/mentions/record-mention-notifications'
import {
  createListSchema,
  updateListSchema,
  addBookSchema,
  updateListBookSchema,
  listIdSchema,
  bookRowIdSchema,
  reorderBooksSchema,
} from '@/lib/validations/reading-list'
import { loadCoverPreviewsMap } from './discover-lists-shared'
import { runAction } from './safe-action'
import type { ActionResult } from './book.actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type BookVisibility = (typeof bookVisibilityEnum.enumValues)[number]

export type ListOwner = {
  userId: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
}

export type ListSummary = {
  id: string
  userId: string
  kind: ReadingListKind
  title: string
  description: string | null
  visibility: BookVisibility
  discoverable: boolean
  tags: string[]
  bookCount: number
  followerCount: number
  createdAt: Date
  updatedAt: Date
  owner: ListOwner
  isFollowing: boolean
  /**
   * Hub-redesign additive projection. Top 3 covers from the list via the
   * shared `loadCoverPreviewsMap` helper. Empty array for lists with no
   * books. Used by the shared `<ListCard>` V2 surface.
   */
  coverPreviews: { bookId: string | null; coverUrl: string | null }[]
}

export type ListBookRow = {
  id: string
  listId: string
  bookId: string | null
  title: string
  author: string
  coverUrl: string | null
  isRead: boolean
  rating: number | null
  commentary: string | null
  order: number
  addedAt: Date
}

export type ListDetail = {
  list: ListSummary
  owner: ListOwner
  isFollowing: boolean
  books: (ListBookRow | DerivedBookRow)[]
}

// ─── Internal helpers ────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

type CursorTuple = { createdAt: string; id: string }

function encodeCursor(c: CursorTuple): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64url')
}

function decodeCursor(s: string | undefined): CursorTuple | null {
  if (!s) return null
  try {
    const raw = Buffer.from(s, 'base64url').toString('utf8')
    const parsed = JSON.parse(raw) as CursorTuple
    if (!parsed || typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createListAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const userId = await requireAuth()
    const parsed = createListSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

    // C5a: extract mentions from description; early cap check.
    const descUsernames = extractMentionUsernamesFromText(
      parsed.data.description ?? '',
    )
    if (descUsernames.length > 5) {
      return { success: false, error: 'MENTION_CAP_EXCEEDED' }
    }

    const id = createId()
    // D3a: stamp first-public if list is born PUBLIC+discoverable (kind=CUSTOM
    // by construction here). last_updated_at seeded to now so denorm is
    // populated from row birth.
    const now = new Date()
    const isInitialPublicDiscoverable =
      parsed.data.visibility === 'PUBLIC' && parsed.data.discoverable === true
    await db.transaction(async (tx) => {
      await tx.insert(readingLists).values({
        id,
        userId,
        kind: 'CUSTOM',
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        visibility: parsed.data.visibility,
        discoverable: parsed.data.discoverable,
        tags: parsed.data.tags,
        firstPubliclyDiscoverableAt: isInitialPublicDiscoverable ? now : null,
        lastUpdatedAt: now,
      })
      if (parsed.data.visibility === 'PUBLIC') {
        await recordSocialActivityTx(tx, {
          actorId: userId,
          type: 'reading_list_created',
          subjectType: 'reading_list',
          subjectId: id,
          payload: { title: parsed.data.title },
        })
      }

      // C5a: resolve + record mentions for description.
      if (descUsernames.length > 0) {
        const r = await resolveMentionedUsers({
          tiptapUserIds: [],
          textUsernames: descUsernames,
          actorId: userId,
          resourceType: 'reading_list_description',
          resourceId: id,
        })
        if (r.ok && r.users.length > 0) {
          const toNotify = r.users
            .filter((u) => !r.alreadyNotified.has(u.userId))
            .map((u) => u.userId)
          if (toNotify.length > 0) {
            await recordMentionNotificationsTx(tx, {
              actorId: userId,
              mentionedUserIds: toNotify,
              resourceType: 'reading_list_description',
              resourceId: id,
            })
          }
        }
      }
    })

    return { success: true, data: { id } }
  })
}

export async function getListsAction(input: {
  filter: 'mine' | 'following' | 'discover'
  cursor?: string
  limit?: number
}): Promise<ActionResult<{ rows: ListSummary[]; nextCursor: string | null }>> {
  const viewerId = await getOptionalUserId()
  const limit = Math.min(input.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
  const cursor = decodeCursor(input.cursor)
  const overFetch = limit + 1

  // 'mine' and 'following' require auth.
  if (input.filter === 'mine' || input.filter === 'following') {
    if (!viewerId) return { success: false, error: 'UNAUTHORIZED' }
  }

  // Build conditions
  const cursorCondition = cursor
    ? or(
        lt(readingLists.createdAt, new Date(cursor.createdAt)),
        and(
          eq(readingLists.createdAt, new Date(cursor.createdAt)),
          lt(readingLists.id, cursor.id),
        ),
      )
    : undefined

  let rawRows: Array<{
    id: string
    userId: string
    kind: ReadingListKind
    title: string
    description: string | null
    visibility: BookVisibility
    discoverable: boolean
    tags: string[]
    bookCount: number
    followerCount: number
    createdAt: Date
    updatedAt: Date
    ownerUsername: string | null
    ownerDisplayName: string | null
    ownerAvatarUrl: string | null
    isFollowingRaw: string | null
  }> = []

  if (input.filter === 'mine') {
    // Liked floats to top via sentinel sort.
    const rows = await db
      .select({
        id: readingLists.id,
        userId: readingLists.userId,
        kind: readingLists.kind,
        title: readingLists.title,
        description: readingLists.description,
        visibility: readingLists.visibility,
        discoverable: readingLists.discoverable,
        tags: readingLists.tags,
        bookCount: readingLists.bookCount,
        followerCount: readingLists.followerCount,
        createdAt: readingLists.createdAt,
        updatedAt: readingLists.updatedAt,
        ownerUsername: userProfiles.username,
        ownerDisplayName: userProfiles.displayName,
        ownerAvatarUrl: userProfiles.avatarUrl,
      })
      .from(readingLists)
      .leftJoin(userProfiles, eq(userProfiles.userId, readingLists.userId))
      .where(
        cursorCondition
          ? and(eq(readingLists.userId, viewerId!), cursorCondition)
          : eq(readingLists.userId, viewerId!),
      )
      .orderBy(
        desc(sql`(${readingLists.kind} = 'LIKED')`),
        desc(readingLists.createdAt),
        desc(readingLists.id),
      )
      .limit(overFetch)

    rawRows = rows.map((r) => ({ ...r, isFollowingRaw: null }))
  } else if (input.filter === 'following') {
    const rows = await db
      .select({
        id: readingLists.id,
        userId: readingLists.userId,
        kind: readingLists.kind,
        title: readingLists.title,
        description: readingLists.description,
        visibility: readingLists.visibility,
        discoverable: readingLists.discoverable,
        tags: readingLists.tags,
        bookCount: readingLists.bookCount,
        followerCount: readingLists.followerCount,
        createdAt: readingLists.createdAt,
        updatedAt: readingLists.updatedAt,
        ownerUsername: userProfiles.username,
        ownerDisplayName: userProfiles.displayName,
        ownerAvatarUrl: userProfiles.avatarUrl,
      })
      .from(readingLists)
      .innerJoin(
        readingListFollows,
        and(
          eq(readingListFollows.listId, readingLists.id),
          eq(readingListFollows.userId, viewerId!),
        ),
      )
      .leftJoin(userProfiles, eq(userProfiles.userId, readingLists.userId))
      .where(cursorCondition ? cursorCondition : undefined)
      .orderBy(desc(readingLists.createdAt), desc(readingLists.id))
      .limit(overFetch)

    rawRows = rows.map((r) => ({ ...r, isFollowingRaw: 'yes' }))
  } else {
    // discover: PUBLIC + discoverable + kind=CUSTOM + block-filtered post-hoc.
    const baseWhere = and(
      eq(readingLists.visibility, 'PUBLIC'),
      eq(readingLists.discoverable, true),
      eq(readingLists.kind, 'CUSTOM'),
    )

    const rows = await db
      .select({
        id: readingLists.id,
        userId: readingLists.userId,
        kind: readingLists.kind,
        title: readingLists.title,
        description: readingLists.description,
        visibility: readingLists.visibility,
        discoverable: readingLists.discoverable,
        tags: readingLists.tags,
        bookCount: readingLists.bookCount,
        followerCount: readingLists.followerCount,
        createdAt: readingLists.createdAt,
        updatedAt: readingLists.updatedAt,
        ownerUsername: userProfiles.username,
        ownerDisplayName: userProfiles.displayName,
        ownerAvatarUrl: userProfiles.avatarUrl,
      })
      .from(readingLists)
      .leftJoin(userProfiles, eq(userProfiles.userId, readingLists.userId))
      .where(cursorCondition ? and(baseWhere, cursorCondition) : baseWhere)
      .orderBy(desc(readingLists.createdAt), desc(readingLists.id))
      .limit(overFetch * 2) // overscan to allow block filtering

    // Post-filter blocked owners (when viewer present).
    const filtered: typeof rows = []
    if (viewerId) {
      const results = await Promise.all(
        rows.map(async (r) => ((await isBlocked(viewerId, r.userId)) ? null : r)),
      )
      for (const r of results) {
        if (r) filtered.push(r)
        if (filtered.length >= overFetch) break
      }
    } else {
      filtered.push(...rows.slice(0, overFetch))
    }

    // Resolve isFollowing via batch query.
    let followingSet: Set<string> = new Set()
    if (viewerId && filtered.length > 0) {
      const listIds = filtered.map((r) => r.id)
      const followRows = await db
        .select({ listId: readingListFollows.listId })
        .from(readingListFollows)
        .where(
          and(
            eq(readingListFollows.userId, viewerId),
            inArray(readingListFollows.listId, listIds),
          ),
        )
      followingSet = new Set(followRows.map((f) => f.listId))
    }

    rawRows = filtered.map((r) => ({
      ...r,
      isFollowingRaw: followingSet.has(r.id) ? 'yes' : null,
    }))
  }

  // For 'mine' we don't need follow flags (it's your own list). For 'following'
  // every row is followed by definition. So isFollowing is already known above.
  const hasMore = rawRows.length > limit
  const page = rawRows.slice(0, limit)
  const last = page[page.length - 1]
  const nextCursor =
    hasMore && last
      ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
      : null

  const coverPreviewsMap = await loadCoverPreviewsMap(page.map((r) => r.id))

  const result: ListSummary[] = page.map((r) => ({
    id: r.id,
    userId: r.userId,
    kind: r.kind,
    title: r.title,
    description: r.description,
    visibility: r.visibility,
    discoverable: r.discoverable,
    tags: r.tags ?? [],
    bookCount: r.bookCount,
    followerCount: r.followerCount,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    owner: {
      userId: r.userId,
      username: r.ownerUsername,
      displayName: r.ownerDisplayName,
      avatarUrl: r.ownerAvatarUrl,
    },
    isFollowing:
      input.filter === 'following' ? true : r.isFollowingRaw !== null,
    coverPreviews: coverPreviewsMap.get(r.id) ?? [],
  }))

  return { success: true, data: { rows: result, nextCursor } }
}

export async function getListAction(
  listId: string,
): Promise<ActionResult<ListDetail>> {
  const viewerId = await getOptionalUserId()

  const list = await db.query.readingLists.findFirst({
    where: eq(readingLists.id, listId),
  })
  if (!list) return { success: false, error: 'NOT_FOUND' }

  // canViewList: block masquerade + visibility check.
  if (!(await canViewList(viewerId, list))) {
    return { success: false, error: 'NOT_FOUND' }
  }

  // Owner profile
  const [owner] = await db
    .select({
      userId: userProfiles.userId,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, list.userId))
    .limit(1)

  const resolvedOwner: ListOwner = {
    userId: list.userId,
    username: owner?.username ?? null,
    displayName: owner?.displayName ?? null,
    avatarUrl: owner?.avatarUrl ?? null,
  }

  // isFollowing
  let isFollowing = false
  if (viewerId && viewerId !== list.userId) {
    const followRow = await db.query.readingListFollows.findFirst({
      where: and(
        eq(readingListFollows.userId, viewerId),
        eq(readingListFollows.listId, listId),
      ),
      columns: { userId: true },
    })
    isFollowing = !!followRow
  }

  // Books — branch by kind.
  let bookRows: (ListBookRow | DerivedBookRow)[]
  if (list.kind === 'LIKED') {
    bookRows = await getLikedListBooks(list.userId, list.id)
  } else {
    const rows = await db
      .select({
        id: readingListBooks.id,
        listId: readingListBooks.listId,
        bookId: readingListBooks.bookId,
        storedTitle: readingListBooks.title,
        storedAuthor: readingListBooks.author,
        storedCoverUrl: readingListBooks.coverUrl,
        isRead: readingListBooks.isRead,
        rating: readingListBooks.rating,
        commentary: readingListBooks.commentary,
        order: readingListBooks.order,
        addedAt: readingListBooks.addedAt,
        bookCurrentTitle: books.title,
        bookCurrentCoverUrl: books.coverUrl,
        bookOwnerUsername: userProfiles.username,
        bookOwnerDisplayName: userProfiles.displayName,
      })
      .from(readingListBooks)
      .leftJoin(books, eq(books.id, readingListBooks.bookId))
      .leftJoin(userProfiles, eq(userProfiles.userId, books.userId))
      .where(eq(readingListBooks.listId, listId))
      .orderBy(asc(readingListBooks.order))

    bookRows = rows.map((r) => ({
      id: r.id,
      listId: r.listId,
      bookId: r.bookId,
      // Prefer current Beehive book title/cover when linked; fall back to stored text.
      title: r.bookId && r.bookCurrentTitle ? r.bookCurrentTitle : r.storedTitle,
      author:
        r.bookId && (r.bookOwnerDisplayName || r.bookOwnerUsername)
          ? r.bookOwnerDisplayName ?? r.bookOwnerUsername ?? r.storedAuthor
          : r.storedAuthor,
      coverUrl:
        r.bookId && r.bookCurrentCoverUrl ? r.bookCurrentCoverUrl : r.storedCoverUrl,
      isRead: r.isRead,
      rating: r.rating,
      commentary: r.commentary,
      order: r.order,
      addedAt: r.addedAt,
    }))
  }

  const summary: ListSummary = {
    id: list.id,
    userId: list.userId,
    kind: list.kind,
    title: list.title,
    description: list.description,
    visibility: list.visibility,
    discoverable: list.discoverable,
    tags: list.tags ?? [],
    bookCount: list.bookCount,
    followerCount: list.followerCount,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
    owner: resolvedOwner,
    isFollowing,
    // Detail surface uses `books` directly; coverPreviews left empty.
    coverPreviews: [],
  }

  return {
    success: true,
    data: { list: summary, owner: resolvedOwner, isFollowing, books: bookRows },
  }
}

// ─── T4: Update / Delete ──────────────────────────────────────────────────────

export async function updateListAction(
  input: unknown,
): Promise<ActionResult<{ updated: boolean }>> {
  return runAction(async () => {
    const userId = await requireAuth()
    const parsed = updateListSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

    const list = await db.query.readingLists.findFirst({
      where: eq(readingLists.id, parsed.data.listId),
      columns: { userId: true, visibility: true, kind: true },
    })
    if (!list) return { success: false, error: 'NOT_FOUND' }
    if (!canEditList(userId, list)) return { success: false, error: 'NOT_ALLOWED' }

    // C5a: extract mentions from description; early cap check.
    const descUsernames =
      parsed.data.description !== undefined
        ? extractMentionUsernamesFromText(parsed.data.description ?? '')
        : []
    if (descUsernames.length > 5) {
      return { success: false, error: 'MENTION_CAP_EXCEEDED' }
    }

    const updates: Partial<typeof readingLists.$inferInsert> = {}
    if (parsed.data.title !== undefined) updates.title = parsed.data.title
    if (parsed.data.description !== undefined)
      updates.description = parsed.data.description
    if (parsed.data.visibility !== undefined)
      updates.visibility = parsed.data.visibility
    if (parsed.data.tags !== undefined) updates.tags = parsed.data.tags

    // 3-layer discoverable defense + Liked-list coercion.
    const effectiveVisibility = parsed.data.visibility ?? list.visibility
    if (parsed.data.discoverable !== undefined) {
      if (list.kind === 'LIKED') {
        updates.discoverable = false
      } else {
        updates.discoverable =
          effectiveVisibility === 'PUBLIC' ? parsed.data.discoverable : false
      }
    } else if (
      parsed.data.visibility !== undefined &&
      effectiveVisibility !== 'PUBLIC'
    ) {
      updates.discoverable = false
    }
    const updateNow = new Date()
    updates.updatedAt = updateNow
    // D3a: bump last_updated_at denorm on any metadata edit.
    updates.lastUpdatedAt = updateNow

    await db.transaction(async (tx) => {
      // D3a: first-public stamp gate. If this update transitions the list into
      // PUBLIC + discoverable + kind=CUSTOM for the first time, stamp
      // firstPubliclyDiscoverableAt. Mirrors D2b updateHiveAction.
      const current = await tx.query.readingLists.findFirst({
        where: eq(readingLists.id, parsed.data.listId),
        columns: {
          visibility: true,
          discoverable: true,
          kind: true,
          firstPubliclyDiscoverableAt: true,
        },
      })
      if (current) {
        const nextVisibility = updates.visibility ?? current.visibility
        const nextDiscoverable =
          updates.discoverable !== undefined
            ? updates.discoverable
            : current.discoverable
        const becomingPublic =
          nextVisibility === 'PUBLIC' &&
          nextDiscoverable === true &&
          current.kind === 'CUSTOM' &&
          current.firstPubliclyDiscoverableAt == null
        if (becomingPublic) {
          updates.firstPubliclyDiscoverableAt = updateNow
        }
      }

      await tx
        .update(readingLists)
        .set(updates)
        .where(eq(readingLists.id, parsed.data.listId))

      // C5a: resolve + record mentions for description on edit.
      if (descUsernames.length > 0) {
        const r = await resolveMentionedUsers({
          tiptapUserIds: [],
          textUsernames: descUsernames,
          actorId: userId,
          resourceType: 'reading_list_description',
          resourceId: parsed.data.listId,
        })
        if (r.ok && r.users.length > 0) {
          const toNotify = r.users
            .filter((u) => !r.alreadyNotified.has(u.userId))
            .map((u) => u.userId)
          if (toNotify.length > 0) {
            await recordMentionNotificationsTx(tx, {
              actorId: userId,
              mentionedUserIds: toNotify,
              resourceType: 'reading_list_description',
              resourceId: parsed.data.listId,
            })
          }
        }
      }
    })

    return { success: true, data: { updated: true } }
  })
}

export async function deleteListAction(
  input: unknown,
): Promise<ActionResult<{ deleted: boolean }>> {
  return runAction(async () => {
    const userId = await requireAuth()
    const parsed = listIdSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

    const list = await db.query.readingLists.findFirst({
      where: eq(readingLists.id, parsed.data.listId),
      columns: { userId: true, kind: true, visibility: true },
    })
    if (!list) return { success: false, error: 'NOT_FOUND' }
    if (!canEditList(userId, list)) return { success: false, error: 'NOT_ALLOWED' }
    if (list.kind === 'LIKED')
      return { success: false, error: 'LIKED_LIST_UNDELETABLE' }

    await db.delete(readingLists).where(eq(readingLists.id, parsed.data.listId))
    return { success: true, data: { deleted: true } }
  })
}

// ─── T5: Book row CRUD ────────────────────────────────────────────────────────

export async function addBookToListAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const userId = await requireAuth()
    const parsed = addBookSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

    const list = await db.query.readingLists.findFirst({
      where: eq(readingLists.id, parsed.data.listId),
      columns: { userId: true, kind: true, visibility: true, title: true },
    })
    if (!list) return { success: false, error: 'NOT_FOUND' }
    if (!canEditList(userId, list)) return { success: false, error: 'NOT_ALLOWED' }
    if (list.kind === 'LIKED')
      return { success: false, error: 'LIKED_LIST_IMMUTABLE' }

    // Validate bookId via canReadBook — privacy gate is load-bearing.
    if (parsed.data.bookId) {
      const access = await canReadBook(parsed.data.bookId, userId)
      if (!access.ok) return { success: false, error: 'BOOK_NOT_FOUND' } // masquerade
    }

    const id = createId()
    await db.transaction(async (tx) => {
      // Compute next order.
      const [orderRow] = await tx
        .select({
          maxOrder: sql<number>`COALESCE(MAX(${readingListBooks.order}), -1)::int`,
        })
        .from(readingListBooks)
        .where(eq(readingListBooks.listId, parsed.data.listId))
      const maxOrder = orderRow?.maxOrder ?? -1

      await tx.insert(readingListBooks).values({
        id,
        listId: parsed.data.listId,
        bookId: parsed.data.bookId ?? null,
        title: parsed.data.title,
        author: parsed.data.author,
        coverUrl: parsed.data.coverUrl ?? null,
        isRead: parsed.data.isRead,
        rating: parsed.data.rating ?? null,
        commentary: parsed.data.commentary ?? null,
        order: maxOrder + 1,
      })

      const addNow = new Date()
      await tx
        .update(readingLists)
        .set({
          bookCount: sql`${readingLists.bookCount} + 1`,
          updatedAt: addNow,
          // D3a: bump last_updated_at denorm on book add.
          lastUpdatedAt: addNow,
        })
        .where(eq(readingLists.id, parsed.data.listId))

      // Dedupe-with-increment activity hook (PUBLIC-only).
      if (list.visibility === 'PUBLIC') {
        const windowStart = new Date(Date.now() - 30 * 60 * 1000)
        const existing = await tx.query.socialActivity.findFirst({
          where: and(
            eq(socialActivity.actorId, userId),
            eq(socialActivity.type, 'books_added_batch'),
            eq(socialActivity.subjectId, parsed.data.listId),
            gte(socialActivity.createdAt, windowStart),
          ),
        })
        if (existing) {
          await tx
            .update(socialActivity)
            .set({
              payload: sql`jsonb_set(${socialActivity.payload}, '{count}', ((${socialActivity.payload}->>'count')::int + 1)::text::jsonb)`,
            })
            .where(eq(socialActivity.id, existing.id))
        } else {
          await recordSocialActivityTx(tx, {
            actorId: userId,
            type: 'books_added_batch',
            subjectType: 'reading_list',
            subjectId: parsed.data.listId,
            payload: { listTitle: list.title, count: 1 },
          })
        }
      }
    })

    return { success: true, data: { id } }
  })
}

export async function updateListBookAction(
  input: unknown,
): Promise<ActionResult<{ updated: boolean }>> {
  return runAction(async () => {
    const userId = await requireAuth()
    const parsed = updateListBookSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

    const row = await db.query.readingListBooks.findFirst({
      where: eq(readingListBooks.id, parsed.data.bookRowId),
      columns: { listId: true },
    })
    if (!row) return { success: false, error: 'NOT_FOUND' }

    const list = await db.query.readingLists.findFirst({
      where: eq(readingLists.id, row.listId),
      columns: { userId: true, kind: true, visibility: true },
    })
    if (!list) return { success: false, error: 'NOT_FOUND' }
    if (!canEditList(userId, list)) return { success: false, error: 'NOT_ALLOWED' }
    if (list.kind === 'LIKED')
      return { success: false, error: 'LIKED_LIST_IMMUTABLE' }

    // C5a: extract mentions from commentary; early cap check.
    const commentaryUsernames =
      parsed.data.commentary !== undefined
        ? extractMentionUsernamesFromText(parsed.data.commentary ?? '')
        : []
    if (commentaryUsernames.length > 5) {
      return { success: false, error: 'MENTION_CAP_EXCEEDED' }
    }

    const updates: Partial<typeof readingListBooks.$inferInsert> = {}
    if (parsed.data.isRead !== undefined) updates.isRead = parsed.data.isRead
    if (parsed.data.rating !== undefined) updates.rating = parsed.data.rating
    if (parsed.data.commentary !== undefined)
      updates.commentary = parsed.data.commentary
    if (parsed.data.order !== undefined) updates.order = parsed.data.order

    await db.transaction(async (tx) => {
      await tx
        .update(readingListBooks)
        .set(updates)
        .where(eq(readingListBooks.id, parsed.data.bookRowId))

      // C5a: resolve + record mentions for commentary edit.
      if (commentaryUsernames.length > 0) {
        const r = await resolveMentionedUsers({
          tiptapUserIds: [],
          textUsernames: commentaryUsernames,
          actorId: userId,
          resourceType: 'reading_list_book_commentary',
          resourceId: parsed.data.bookRowId,
        })
        if (r.ok && r.users.length > 0) {
          const toNotify = r.users
            .filter((u) => !r.alreadyNotified.has(u.userId))
            .map((u) => u.userId)
          if (toNotify.length > 0) {
            await recordMentionNotificationsTx(tx, {
              actorId: userId,
              mentionedUserIds: toNotify,
              resourceType: 'reading_list_book_commentary',
              resourceId: parsed.data.bookRowId,
            })
          }
        }
      }
    })

    return { success: true, data: { updated: true } }
  })
}

export async function removeBookFromListAction(
  input: unknown,
): Promise<ActionResult<{ removed: boolean }>> {
  return runAction(async () => {
    const userId = await requireAuth()
    const parsed = bookRowIdSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

    const row = await db.query.readingListBooks.findFirst({
      where: eq(readingListBooks.id, parsed.data.bookRowId),
      columns: { listId: true },
    })
    if (!row) return { success: false, error: 'NOT_FOUND' }

    const list = await db.query.readingLists.findFirst({
      where: eq(readingLists.id, row.listId),
      columns: { userId: true, kind: true, visibility: true },
    })
    if (!list) return { success: false, error: 'NOT_FOUND' }
    if (!canEditList(userId, list)) return { success: false, error: 'NOT_ALLOWED' }
    if (list.kind === 'LIKED')
      return { success: false, error: 'LIKED_LIST_IMMUTABLE' }

    await db.transaction(async (tx) => {
      await tx
        .delete(readingListBooks)
        .where(eq(readingListBooks.id, parsed.data.bookRowId))
      const removeNow = new Date()
      await tx
        .update(readingLists)
        .set({
          bookCount: sql`GREATEST(${readingLists.bookCount} - 1, 0)`,
          updatedAt: removeNow,
          // D3a: bump last_updated_at denorm on book remove.
          lastUpdatedAt: removeNow,
        })
        .where(eq(readingLists.id, row.listId))
    })

    return { success: true, data: { removed: true } }
  })
}

export async function reorderListBooksAction(
  input: unknown,
): Promise<ActionResult<{ reordered: boolean }>> {
  return runAction(async () => {
    const userId = await requireAuth()
    const parsed = reorderBooksSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

    const list = await db.query.readingLists.findFirst({
      where: eq(readingLists.id, parsed.data.listId),
      columns: { userId: true, kind: true, visibility: true },
    })
    if (!list) return { success: false, error: 'NOT_FOUND' }
    if (!canEditList(userId, list)) return { success: false, error: 'NOT_ALLOWED' }
    if (list.kind === 'LIKED')
      return { success: false, error: 'LIKED_LIST_IMMUTABLE' }

    await db.transaction(async (tx) => {
      for (let i = 0; i < parsed.data.orderedIds.length; i++) {
        await tx
          .update(readingListBooks)
          .set({ order: i })
          .where(
            and(
              eq(readingListBooks.id, parsed.data.orderedIds[i]),
              eq(readingListBooks.listId, parsed.data.listId),
            ),
          )
      }
    })

    return { success: true, data: { reordered: true } }
  })
}

// ─── T6: Follow / unfollow / count / discover wrapper ────────────────────────

export async function followListAction(
  input: unknown,
): Promise<ActionResult<{ followed: boolean }>> {
  return runAction(async () => {
    const userId = await requireAuth()
    const parsed = listIdSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

    const list = await db.query.readingLists.findFirst({
      where: eq(readingLists.id, parsed.data.listId),
      columns: { userId: true, visibility: true },
    })
    if (!list) return { success: false, error: 'NOT_FOUND' }
    if (!(await canFollowList(userId, list)))
      return { success: false, error: 'NOT_ALLOWED' }

    let followed = false
    await db.transaction(async (tx) => {
      const result = await tx
        .insert(readingListFollows)
        .values({ userId, listId: parsed.data.listId })
        .onConflictDoNothing()
        .returning({ userId: readingListFollows.userId })
      if (result.length > 0) {
        followed = true
        await tx
          .update(readingLists)
          .set({ followerCount: sql`${readingLists.followerCount} + 1` })
          .where(eq(readingLists.id, parsed.data.listId))
      }
    })

    return { success: true, data: { followed } }
  })
}

export async function unfollowListAction(
  input: unknown,
): Promise<ActionResult<{ removed: boolean }>> {
  return runAction(async () => {
    const userId = await requireAuth()
    const parsed = listIdSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

    let removed = false
    await db.transaction(async (tx) => {
      const result = await tx
        .delete(readingListFollows)
        .where(
          and(
            eq(readingListFollows.userId, userId),
            eq(readingListFollows.listId, parsed.data.listId),
          ),
        )
        .returning({ userId: readingListFollows.userId })
      if (result.length > 0) {
        removed = true
        await tx
          .update(readingLists)
          .set({
            followerCount: sql`GREATEST(${readingLists.followerCount} - 1, 0)`,
          })
          .where(eq(readingLists.id, parsed.data.listId))
      }
    })

    return { success: true, data: { removed } }
  })
}

export async function getListFollowersCountAction(
  listId: string,
): Promise<ActionResult<number>> {
  const [row] = await db
    .select({ count: readingLists.followerCount })
    .from(readingLists)
    .where(eq(readingLists.id, listId))
    .limit(1)
  return { success: true, data: row?.count ?? 0 }
}

export async function getDiscoverableListsAction(input: {
  cursor?: string
  limit?: number
}): Promise<ActionResult<{ rows: ListSummary[]; nextCursor: string | null }>> {
  return getListsAction({
    filter: 'discover',
    cursor: input.cursor,
    limit: input.limit,
  })
}

// ─── T15: Public profile Lists section ────────────────────────────────────────
// Returns a target user's CUSTOM lists (excludes Liked) that the viewer can
// see, respecting block + visibility. Mirrors T4 discover-list canViewList
// per-row filter. Overscan ×2 to absorb post-filter loss without paging.
//
// NOT cursor-paginated — caller is the profile page which shows up to `limit`
// (default 5). isFollowing left false; this surface doesn't expose follow CTA.

export async function getUserPublicListsAction(
  targetUserId: string,
  limit = 5,
): Promise<ActionResult<ListSummary[]>> {
  const viewerId = await getOptionalUserId()
  const cap = Math.min(Math.max(limit, 1), MAX_PAGE_SIZE)

  const candidates = await db
    .select({
      id: readingLists.id,
      userId: readingLists.userId,
      kind: readingLists.kind,
      title: readingLists.title,
      description: readingLists.description,
      visibility: readingLists.visibility,
      discoverable: readingLists.discoverable,
      tags: readingLists.tags,
      bookCount: readingLists.bookCount,
      followerCount: readingLists.followerCount,
      createdAt: readingLists.createdAt,
      updatedAt: readingLists.updatedAt,
      ownerUsername: userProfiles.username,
      ownerDisplayName: userProfiles.displayName,
      ownerAvatarUrl: userProfiles.avatarUrl,
    })
    .from(readingLists)
    .leftJoin(userProfiles, eq(userProfiles.userId, readingLists.userId))
    .where(
      and(
        eq(readingLists.userId, targetUserId),
        ne(readingLists.kind, 'LIKED'),
      ),
    )
    .orderBy(desc(readingLists.createdAt), desc(readingLists.id))
    .limit(cap * 2)

  const visible: ListSummary[] = []
  for (const row of candidates) {
    const allowed = await canViewList(viewerId, {
      userId: row.userId,
      visibility: row.visibility,
    })
    if (!allowed) continue
    visible.push({
      id: row.id,
      userId: row.userId,
      kind: row.kind,
      title: row.title,
      description: row.description,
      visibility: row.visibility,
      discoverable: row.discoverable,
      tags: row.tags ?? [],
      bookCount: row.bookCount,
      followerCount: row.followerCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      owner: {
        userId: row.userId,
        username: row.ownerUsername,
        displayName: row.ownerDisplayName,
        avatarUrl: row.ownerAvatarUrl,
      },
      isFollowing: false,
      coverPreviews: [],
    })
    if (visible.length >= cap) break
  }

  // Hydrate coverPreviews for the visible slice via the shared helper.
  if (visible.length > 0) {
    const coverMap = await loadCoverPreviewsMap(visible.map((v) => v.id))
    for (const v of visible) {
      v.coverPreviews = coverMap.get(v.id) ?? []
    }
  }

  return { success: true, data: visible }
}

// -----------------------------------------------------------------------------
// C5b T9 — Parent-id lookup action for MENTION notification deep links.
// -----------------------------------------------------------------------------

export async function getListBookCommentaryListIdAction(
  rowId: string,
): Promise<
  | { success: true; data: { listId: string } }
  | { success: false; error: string }
> {
  await requireAuth()
  const row = await db.query.readingListBooks.findFirst({
    where: eq(readingListBooks.id, rowId),
    columns: { listId: true },
  })
  if (!row) return { success: false, error: 'NOT_FOUND' }
  return { success: true, data: { listId: row.listId } }
}
