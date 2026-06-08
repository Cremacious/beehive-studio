import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── In-memory store ────────────────────────────────────────────────────────
type Row = {
  id: string
  requesterId: string
  recipientId: string
  status: 'PENDING' | 'ACCEPTED'
  createdAt: Date
  acceptedAt: Date | null
}
const store: { rows: Row[]; profiles: Array<{ userId: string; username: string; displayName: string | null; avatarUrl: string | null }> } = {
  rows: [],
  profiles: [],
}
let idCounter = 0

function reset() {
  store.rows = []
  store.profiles = []
  idCounter = 0
}

function tableName(table: any): string {
  if (table && typeof table === 'object') {
    const sym = Object.getOwnPropertySymbols(table).find((s) => s.description === 'drizzle:Name')
    if (sym) return (table as any)[sym]
  }
  return '<unknown>'
}

// Drizzle's `and(...)`/`or(...)`/`eq(...)` return condition objects we just
// need to evaluate later. We carry a `predicate` function so the mock select
// can filter rows after the .where(...) call.
type Predicate = (row: Row) => boolean

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    and: (...preds: any[]) => ({ __kind: 'and', preds }),
    or: (...preds: any[]) => ({ __kind: 'or', preds }),
    eq: (column: any, value: any) => ({ __kind: 'eq', column, value }),
    desc: (column: any) => ({ __kind: 'desc', column }),
  }
})

// Translate the captured column object to a row-field accessor by inspecting
// its drizzle column name symbol.
function fieldNameOf(column: any): string | null {
  if (!column || typeof column !== 'object') return null
  const syms = Object.getOwnPropertySymbols(column)
  for (const s of syms) {
    if (s.description === 'drizzle:Name') return (column as any)[s]
  }
  // fallback: read .name
  return (column as any).name ?? null
}

const FIELD_TO_ROW: Record<string, keyof Row> = {
  id: 'id',
  requester_id: 'requesterId',
  recipient_id: 'recipientId',
  status: 'status',
  created_at: 'createdAt',
  accepted_at: 'acceptedAt',
}

function evalPred(pred: any, row: Row): boolean {
  if (!pred) return true
  if (pred.__kind === 'and') return pred.preds.every((p: any) => evalPred(p, row))
  if (pred.__kind === 'or') return pred.preds.some((p: any) => evalPred(p, row))
  if (pred.__kind === 'eq') {
    const f = fieldNameOf(pred.column)
    if (!f) return false
    const key = FIELD_TO_ROW[f] ?? (f as keyof Row)
    return row[key] === pred.value
  }
  return false
}

// ── DB mock ────────────────────────────────────────────────────────────────
vi.mock('@/db', () => {
  const dbRef: any = {}
  const mod = {
    db: {
      select: (_proj?: any) => ({
        from: (table: any) => {
          const tname = tableName(table)
          return {
            where: (pred: any) => {
              const filterRows = () =>
                tname === 'friendships' ? store.rows.filter((r) => evalPred(pred, r)) : []
              const filterProfiles = () => {
                // We only use profile select in listFriends / listPending; the
                // predicate is an `or(eq(userId,...))`. Extract userIds from it.
                const ids: string[] = []
                const walk = (p: any) => {
                  if (!p) return
                  if (p.__kind === 'or') p.preds.forEach(walk)
                  if (p.__kind === 'and') p.preds.forEach(walk)
                  if (p.__kind === 'eq') ids.push(p.value)
                }
                walk(pred)
                return store.profiles.filter((p) => ids.includes(p.userId))
              }
              const finalArr = () => (tname === 'user_profiles' ? filterProfiles() : filterRows())
              return {
                limit: async (n: number) => finalArr().slice(0, n),
                orderBy: () => ({
                  // No-op: tests don't depend on ordering
                  then: (cb: any) => cb(finalArr()),
                  [Symbol.asyncIterator]: undefined,
                }),
                // Some callers don't chain — return PromiseLike directly.
                then: (cb: any) => cb(finalArr()),
              }
            },
          }
        },
      }),
      insert: (table: any) => {
        const tname = tableName(table)
        return {
          values: (values: any) => {
            if (tname === 'friendships') {
              const id = `fr-${++idCounter}`
              store.rows.push({
                id,
                requesterId: values.requesterId,
                recipientId: values.recipientId,
                status: values.status ?? 'PENDING',
                createdAt: new Date(),
                acceptedAt: null,
              })
              return {
                returning: async () => [{ id }],
                then: (cb: any) => cb(undefined),
              }
            }
            // notifications / other tables — no-op
            return {
              returning: async () => [],
              then: (cb: any) => cb(undefined),
            }
          },
        }
      },
      update: (_table: any) => ({
        set: (values: any) => ({
          where: async (pred: any) => {
            for (const r of store.rows) {
              if (evalPred(pred, r)) Object.assign(r, values)
            }
          },
        }),
      }),
      delete: (_table: any) => ({
        where: async (pred: any) => {
          store.rows = store.rows.filter((r) => !evalPred(pred, r))
        },
      }),
      transaction: async (fn: any) => fn(mod.db),
      query: {
        userBlocks: {
          findFirst: async () => undefined,
        },
        notificationPreferences: {
          findFirst: async () => undefined,
        },
      },
    },
  }
  dbRef.db = mod.db
  return mod
})

vi.mock('@/lib/require-auth', () => ({
  requireAuth: async () => currentUserId,
}))

let currentUserId = 'user-a'
function as(id: string) {
  currentUserId = id
}

// Import after mocks
import {
  sendFriendRequestAction,
  acceptFriendRequestAction,
  rejectFriendRequestAction,
  cancelFriendRequestAction,
  unfriendAction,
  getFriendshipStatusAction,
} from '../friendships.actions'

beforeEach(() => {
  reset()
  currentUserId = 'user-a'
})

describe('friendships actions', () => {
  it('sendFriendRequest creates a PENDING row (happy path)', async () => {
    as('user-a')
    const r = await sendFriendRequestAction({ recipientId: 'user-b' })
    expect(r.success).toBe(true)
    expect((r as any).data.autoAccepted).toBe(false)
    expect(store.rows).toHaveLength(1)
    expect(store.rows[0].status).toBe('PENDING')
    expect(store.rows[0].requesterId).toBe('user-a')
    expect(store.rows[0].recipientId).toBe('user-b')
  })

  it('sendFriendRequest auto-accepts when an incoming PENDING already exists', async () => {
    // user-b previously requested user-a
    store.rows.push({
      id: 'pre-1',
      requesterId: 'user-b',
      recipientId: 'user-a',
      status: 'PENDING',
      createdAt: new Date(),
      acceptedAt: null,
    })
    as('user-a')
    const r = await sendFriendRequestAction({ recipientId: 'user-b' })
    expect(r.success).toBe(true)
    expect((r as any).data.autoAccepted).toBe(true)
    expect(store.rows[0].status).toBe('ACCEPTED')
    expect(store.rows[0].acceptedAt).toBeInstanceOf(Date)
  })

  it('sendFriendRequest blocked when ALREADY_FRIENDS', async () => {
    store.rows.push({
      id: 'pre-1',
      requesterId: 'user-a',
      recipientId: 'user-b',
      status: 'ACCEPTED',
      createdAt: new Date(),
      acceptedAt: new Date(),
    })
    as('user-a')
    const r = await sendFriendRequestAction({ recipientId: 'user-b' })
    expect(r.success).toBe(false)
    expect((r as any).error).toBe('ALREADY_FRIENDS')
  })

  it('sendFriendRequest blocked when ALREADY_REQUESTED', async () => {
    store.rows.push({
      id: 'pre-1',
      requesterId: 'user-a',
      recipientId: 'user-b',
      status: 'PENDING',
      createdAt: new Date(),
      acceptedAt: null,
    })
    as('user-a')
    const r = await sendFriendRequestAction({ recipientId: 'user-b' })
    expect(r.success).toBe(false)
    expect((r as any).error).toBe('ALREADY_REQUESTED')
  })

  it('sendFriendRequest rejects self-friend', async () => {
    as('user-a')
    const r = await sendFriendRequestAction({ recipientId: 'user-a' })
    expect(r.success).toBe(false)
    expect((r as any).error).toBe('CANNOT_FRIEND_SELF')
  })

  it('acceptFriendRequest only by recipient', async () => {
    store.rows.push({
      id: 'fr-X',
      requesterId: 'user-a',
      recipientId: 'user-b',
      status: 'PENDING',
      createdAt: new Date(),
      acceptedAt: null,
    })
    // Wrong user
    as('user-c')
    const bad = await acceptFriendRequestAction({ friendshipId: 'fr-X' })
    expect(bad.success).toBe(false)
    expect((bad as any).error).toBe('NOT_AUTHORIZED')
    expect(store.rows[0].status).toBe('PENDING')
    // Right user
    as('user-b')
    const ok = await acceptFriendRequestAction({ friendshipId: 'fr-X' })
    expect(ok.success).toBe(true)
    expect(store.rows[0].status).toBe('ACCEPTED')
  })

  it('rejectFriendRequest deletes the row (only recipient)', async () => {
    store.rows.push({
      id: 'fr-X',
      requesterId: 'user-a',
      recipientId: 'user-b',
      status: 'PENDING',
      createdAt: new Date(),
      acceptedAt: null,
    })
    as('user-b')
    const r = await rejectFriendRequestAction({ friendshipId: 'fr-X' })
    expect(r.success).toBe(true)
    expect(store.rows).toHaveLength(0)
  })

  it('cancelFriendRequest deletes the row (only requester)', async () => {
    store.rows.push({
      id: 'fr-X',
      requesterId: 'user-a',
      recipientId: 'user-b',
      status: 'PENDING',
      createdAt: new Date(),
      acceptedAt: null,
    })
    // Recipient can't cancel
    as('user-b')
    const bad = await cancelFriendRequestAction({ friendshipId: 'fr-X' })
    expect(bad.success).toBe(false)
    expect((bad as any).error).toBe('NOT_AUTHORIZED')
    // Requester can
    as('user-a')
    const ok = await cancelFriendRequestAction({ friendshipId: 'fr-X' })
    expect(ok.success).toBe(true)
    expect(store.rows).toHaveLength(0)
  })

  it('unfriendAction works regardless of which user was the requester', async () => {
    // Case 1: viewer was the requester
    store.rows.push({
      id: 'fr-A',
      requesterId: 'user-a',
      recipientId: 'user-b',
      status: 'ACCEPTED',
      createdAt: new Date(),
      acceptedAt: new Date(),
    })
    as('user-a')
    let r = await unfriendAction({ otherUserId: 'user-b' })
    expect(r.success).toBe(true)
    expect(store.rows).toHaveLength(0)

    // Case 2: viewer was the recipient
    store.rows.push({
      id: 'fr-B',
      requesterId: 'user-c',
      recipientId: 'user-a',
      status: 'ACCEPTED',
      createdAt: new Date(),
      acceptedAt: new Date(),
    })
    as('user-a')
    r = await unfriendAction({ otherUserId: 'user-c' })
    expect(r.success).toBe(true)
    expect(store.rows).toHaveLength(0)
  })

  it('getFriendshipStatusAction returns each of the 4 states', async () => {
    as('user-a')
    // NONE
    let r = await getFriendshipStatusAction('user-b')
    expect(r.success && r.data).toBe('NONE')

    // PENDING_OUTGOING
    store.rows = [{
      id: 'r1', requesterId: 'user-a', recipientId: 'user-b',
      status: 'PENDING', createdAt: new Date(), acceptedAt: null,
    }]
    r = await getFriendshipStatusAction('user-b')
    expect(r.success && r.data).toBe('PENDING_OUTGOING')

    // PENDING_INCOMING
    store.rows = [{
      id: 'r2', requesterId: 'user-b', recipientId: 'user-a',
      status: 'PENDING', createdAt: new Date(), acceptedAt: null,
    }]
    r = await getFriendshipStatusAction('user-b')
    expect(r.success && r.data).toBe('PENDING_INCOMING')

    // ACCEPTED
    store.rows = [{
      id: 'r3', requesterId: 'user-a', recipientId: 'user-b',
      status: 'ACCEPTED', createdAt: new Date(), acceptedAt: new Date(),
    }]
    r = await getFriendshipStatusAction('user-b')
    expect(r.success && r.data).toBe('ACCEPTED')
  })
})
