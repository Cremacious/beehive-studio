import { requireAdmin } from '@/lib/admin/require-admin'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { UserRow } from './user-row'

export const dynamic = 'force-dynamic'

interface SearchParams {
  q?: string
  page?: string
}

const PAGE_SIZE = 50

interface Row {
  id: string
  email: string
  name: string | null
  username: string | null
  createdAt: Date
  banned: boolean | null
  bannedReason: string | null
  subscriptionStatus: string | null
  compEntitlementUntil: Date | null
}

async function fetchUsers(q: string | undefined, page: number) {
  const offset = page * PAGE_SIZE
  const like = q ? `%${q.toLowerCase()}%` : null

  const rowResult = await db.execute(sql`
    SELECT
      u.id,
      u.email,
      u.name,
      u.banned,
      u.banned_reason AS "bannedReason",
      u.created_at AS "createdAt",
      p.username,
      b.subscription_status AS "subscriptionStatus",
      b.comp_entitlement_until AS "compEntitlementUntil"
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    LEFT JOIN user_billing b ON b.user_id = u.id
    ${like
      ? sql`WHERE lower(u.email) LIKE ${like} OR lower(coalesce(p.username, '')) LIKE ${like} OR lower(coalesce(u.name, '')) LIKE ${like}`
      : sql``}
    ORDER BY u.created_at DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `)
  const rows = (rowResult.rows ?? rowResult) as unknown as Row[]

  const countResult = await db.execute(sql`
    SELECT count(*)::int AS n FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    ${like
      ? sql`WHERE lower(u.email) LIKE ${like} OR lower(coalesce(p.username, '')) LIKE ${like} OR lower(coalesce(u.name, '')) LIKE ${like}`
      : sql``}
  `)
  const countRows = (countResult.rows ?? countResult) as unknown as { n: number }[]
  const n = countRows[0]?.n ?? 0

  return { rows, total: n }
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requireAdmin()
  const params = await searchParams
  const page = Math.max(0, Number(params.page ?? '0') | 0)
  const q = params.q?.trim() || undefined

  const { rows, total } = await fetchUsers(q, page)
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1
          className="font-bold text-3xl"
          style={{ fontFamily: 'var(--font-display, Comfortaa)', color: 'var(--brand)' }}
        >
          Users
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          {total.toLocaleString()} total
        </p>
      </header>

      <form method="get" className="flex gap-2 items-center">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search email, username, name…"
          className="h-9 w-80 rounded-[var(--r-row)] px-3 text-sm outline-none focus:ring-2"
          style={{
            background: 'var(--canvas-dark-100)',
            boxShadow: 'var(--sh-inset)',
            color: 'var(--canvas-dark-ink-strong)',
          }}
        />
        <button
          type="submit"
          className="h-9 px-4 rounded-[var(--r-pill)] text-sm font-semibold"
          style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
        >
          Search
        </button>
      </form>

      <div
        className="rounded-[var(--r-card)]"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          boxShadow: 'var(--sh-card)',
          borderTop: 'var(--br-card)',
        }}
      >
        <div
          className="grid px-5 py-2.5 text-[10px] font-mono uppercase tracking-[0.14em] rounded-t-[var(--r-card)]"
          style={{
            gridTemplateColumns: '1.4fr 0.9fr 0.8fr 0.9fr 1fr',
            background: 'var(--canvas-dark-100)',
            color: 'var(--canvas-dark-ink-muted)',
            borderBottom: 'var(--br-card)',
          }}
        >
          <span>User</span>
          <span>Joined</span>
          <span>Tier</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>
        {rows.length === 0 ? (
          <p
            className="px-5 py-6 text-sm italic"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            No users match.
          </p>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--canvas-dark-300)' }}>
            {rows.map((row) => (
              <UserRow key={row.id} row={row} />
            ))}
          </ul>
        )}
      </div>

      <Pagination page={page} lastPage={lastPage} q={q} />
    </div>
  )
}

function Pagination({
  page,
  lastPage,
  q,
}: {
  page: number
  lastPage: number
  q: string | undefined
}) {
  const prev = page > 0 ? `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page - 1) })}` : null
  const next =
    page < lastPage
      ? `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page + 1) })}`
      : null
  return (
    <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--canvas-dark-ink)' }}>
      {prev ? (
        <a href={prev} className="underline">
          ← Previous
        </a>
      ) : (
        <span style={{ color: 'var(--canvas-dark-ink-muted)' }}>← Previous</span>
      )}
      <span style={{ color: 'var(--canvas-dark-ink-muted)' }}>
        Page {page + 1} of {lastPage + 1}
      </span>
      {next ? (
        <a href={next} className="underline">
          Next →
        </a>
      ) : (
        <span style={{ color: 'var(--canvas-dark-ink-muted)' }}>Next →</span>
      )}
    </div>
  )
}
