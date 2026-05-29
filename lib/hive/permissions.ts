import { db } from '@/db'
import { hives, hiveMembers, books, binderItems } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export type HiveRole = 'OWNER' | 'MODERATOR' | 'CONTRIBUTOR' | 'BETA_READER'

// ── Throw-or-return-role helpers ────────────────────────────────────────────
export async function requireHiveMember(hiveId: string, userId: string): Promise<HiveRole> {
  const m = await db.query.hiveMembers.findFirst({
    where: and(eq(hiveMembers.hiveId, hiveId), eq(hiveMembers.userId, userId)),
    columns: { role: true },
  })
  if (!m) throw new Error('NOT_HIVE_MEMBER')
  return m.role as HiveRole
}

export async function requireHiveMod(hiveId: string, userId: string): Promise<HiveRole> {
  const role = await requireHiveMember(hiveId, userId)
  if (role !== 'OWNER' && role !== 'MODERATOR') throw new Error('NOT_AUTHORIZED')
  return role
}

export async function requireHiveOwner(hiveId: string, userId: string): Promise<HiveRole> {
  const h = await db.query.hives.findFirst({
    where: and(eq(hives.id, hiveId), eq(hives.ownerId, userId)),
    columns: { id: true },
  })
  if (!h) throw new Error('NOT_HIVE_OWNER')
  return 'OWNER'
}

// ── Pure predicates ─────────────────────────────────────────────────────────
export const canEditWiki = (r: HiveRole) => r !== 'BETA_READER'
export const canSubmitChapter = (r: HiveRole) => r === 'CONTRIBUTOR'
export const canReviewSubmissions = (r: HiveRole) => r === 'OWNER' || r === 'MODERATOR'
export const canAnnotate = (_r: HiveRole) => true
export const canSuggestEdits = (_r: HiveRole) => true
export const canEditOutline = (r: HiveRole) => r !== 'BETA_READER'
export const canManageMembers = (r: HiveRole) => r === 'OWNER' || r === 'MODERATOR'
export const canDeleteHive = (r: HiveRole) => r === 'OWNER'

// ── Binder write permission ─────────────────────────────────────────────────
export type BinderItemTypeForPermission =
  | 'chapter' | 'part' | 'front_matter' | 'back_matter'
  | 'wiki_entry' | 'wiki_folder' | 'character'
  | 'outline' | 'research_note' | 'research_folder'

/**
 * Determines whether `userId` may write to the given binder item.
 *
 *  - Book author wins outright (always allowed).
 *  - Else lookup the hive tied to the book; non-member → NOT_AUTHORIZED.
 *  - Branch on item type:
 *      chapter | part | front_matter | back_matter   → NOT_AUTHORIZED (author only;
 *                                                       hive members go through H3's
 *                                                       submission/suggestion flow)
 *      wiki_entry | wiki_folder | character          → require canEditWiki(role)
 *      outline                                       → require canEditOutline(role)
 *      research_note | research_folder               → require canEditWiki(role)
 */
export async function requireBinderWritePermission(
  bookId: string,
  binderItemId: string,
  userId: string,
): Promise<void> {
  // 1. Author bypass
  const book = await db.query.books.findFirst({
    where: eq(books.id, bookId),
    columns: { userId: true },
  })
  if (!book) throw new Error('BOOK_NOT_FOUND')
  if (book.userId === userId) return

  // 2. Resolve hive for this book
  const hive = await db.query.hives.findFirst({
    where: eq(hives.bookId, bookId),
    columns: { id: true },
  })
  if (!hive) throw new Error('NOT_AUTHORIZED')

  // 3. Resolve role
  const member = await db.query.hiveMembers.findFirst({
    where: and(eq(hiveMembers.hiveId, hive.id), eq(hiveMembers.userId, userId)),
    columns: { role: true },
  })
  if (!member) throw new Error('NOT_AUTHORIZED')
  const role = member.role as HiveRole

  // 4. Resolve item type
  const item = await db.query.binderItems.findFirst({
    where: eq(binderItems.id, binderItemId),
    columns: { type: true, bookId: true },
  })
  if (!item || item.bookId !== bookId) throw new Error('BINDER_ITEM_NOT_FOUND')

  // 5. Type-based branch
  switch (item.type as BinderItemTypeForPermission) {
    case 'chapter':
    case 'part':
    case 'front_matter':
    case 'back_matter':
      throw new Error('NOT_AUTHORIZED')   // H3 owns the submission flow
    case 'outline':
      if (!canEditOutline(role)) throw new Error('NOT_AUTHORIZED')
      return
    case 'wiki_entry':
    case 'wiki_folder':
    case 'character':
    case 'research_note':
    case 'research_folder':
      if (!canEditWiki(role)) throw new Error('NOT_AUTHORIZED')
      return
  }
}

/**
 * Same shape as `requireBinderWritePermission`, but for CREATE flows where
 * the binder item doesn't exist yet — the caller supplies the intended `type`
 * directly instead of us looking it up.
 */
export async function requireBinderCreatePermission(
  bookId: string,
  type: BinderItemTypeForPermission,
  userId: string,
): Promise<void> {
  // 1. Author bypass
  const book = await db.query.books.findFirst({
    where: eq(books.id, bookId),
    columns: { userId: true },
  })
  if (!book) throw new Error('BOOK_NOT_FOUND')
  if (book.userId === userId) return

  // 2. Resolve hive for this book
  const hive = await db.query.hives.findFirst({
    where: eq(hives.bookId, bookId),
    columns: { id: true },
  })
  if (!hive) throw new Error('NOT_AUTHORIZED')

  // 3. Resolve role
  const member = await db.query.hiveMembers.findFirst({
    where: and(eq(hiveMembers.hiveId, hive.id), eq(hiveMembers.userId, userId)),
    columns: { role: true },
  })
  if (!member) throw new Error('NOT_AUTHORIZED')
  const role = member.role as HiveRole

  // 4. Type-based branch (mirrors requireBinderWritePermission)
  switch (type) {
    case 'chapter':
    case 'part':
    case 'front_matter':
    case 'back_matter':
      throw new Error('NOT_AUTHORIZED')   // H3 owns the submission flow
    case 'outline':
      if (!canEditOutline(role)) throw new Error('NOT_AUTHORIZED')
      return
    case 'wiki_entry':
    case 'wiki_folder':
    case 'character':
    case 'research_note':
    case 'research_folder':
      if (!canEditWiki(role)) throw new Error('NOT_AUTHORIZED')
      return
  }
}
