import { db } from '@/db'
import { hives, hiveMembers } from '@/db/schema'
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
