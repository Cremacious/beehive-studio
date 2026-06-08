// lib/mentions/resolve-mentions.ts
import { db } from '@/db'
import { userProfiles } from '@/db/schema/auth'
import { notifications } from '@/db/schema/social'
import { isBlocked } from '@/lib/social/is-blocked'
import { and, eq, gte, inArray, or, sql } from 'drizzle-orm'
import type { SurfaceType } from './surface-types'

const MENTION_CAP = 5
const DEDUPE_WINDOW_HOURS = 24

export type ResolvedMention = { userId: string; username: string }

type ResolveResult =
  | { ok: true; users: ResolvedMention[]; alreadyNotified: Set<string> }
  | { ok: false; error: 'MENTION_CAP_EXCEEDED' }

export async function resolveMentionedUsers(opts: {
  tiptapUserIds: string[]
  textUsernames: string[]
  actorId: string
  resourceType: SurfaceType
  resourceId: string
}): Promise<ResolveResult> {
  const { tiptapUserIds, textUsernames, actorId, resourceType, resourceId } = opts

  // Cap check on combined distinct input set
  const distinctInputs = new Set<string>([...tiptapUserIds, ...textUsernames])
  if (distinctInputs.size > MENTION_CAP) {
    return { ok: false, error: 'MENTION_CAP_EXCEEDED' }
  }

  if (distinctInputs.size === 0) {
    return { ok: true, users: [], alreadyNotified: new Set() }
  }

  // IN-list lookup: by id OR lower(username)
  const candidates = await db
    .select({ id: userProfiles.userId, username: userProfiles.username })
    .from(userProfiles)
    .where(
      or(
        tiptapUserIds.length > 0 ? inArray(userProfiles.userId, tiptapUserIds) : sql`false`,
        textUsernames.length > 0 ? inArray(sql`lower(${userProfiles.username})`, textUsernames) : sql`false`
      )
    )

  // Dedupe by id (username can be null on the row; coerce to empty string for the type)
  const byId = new Map<string, ResolvedMention>()
  for (const c of candidates) {
    if (!c.id) continue
    byId.set(c.id, { userId: c.id, username: c.username ?? '' })
  }

  // Self-mention filter
  byId.delete(actorId)

  // Block filter (bidirectional via isBlocked semantics)
  const filtered: ResolvedMention[] = []
  for (const candidate of byId.values()) {
    const blocked = await isBlocked(actorId, candidate.userId)
    if (!blocked) filtered.push(candidate)
  }

  // Dedupe vs prior notifications within 24h
  const cutoff = new Date(Date.now() - DEDUPE_WINDOW_HOURS * 60 * 60 * 1000)
  const priorRows = filtered.length > 0
    ? await db
        .select({ userId: notifications.userId })
        .from(notifications)
        .where(
          and(
            eq(notifications.type, 'MENTION'),
            eq(notifications.actorId, actorId),
            eq(notifications.resourceType, resourceType),
            eq(notifications.resourceId, resourceId),
            gte(notifications.createdAt, cutoff)
          )
        )
    : []
  const alreadyNotified = new Set(priorRows.map((r) => r.userId))

  return { ok: true, users: filtered, alreadyNotified }
}
