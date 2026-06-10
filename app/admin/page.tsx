import { requireAdmin } from '@/lib/admin/require-admin'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { users, books, hives, userBilling, promoCodes, adminActions } from '@/db/schema'
import { or, and, gt, isNotNull, inArray, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

async function getStats() {
  const [userRow] = await db.select({ n: sql<number>`count(*)::int` }).from(users)
  const [bookRow] = await db.select({ n: sql<number>`count(*)::int` }).from(books)
  const [hiveRow] = await db.select({ n: sql<number>`count(*)::int` }).from(hives)
  const [premiumRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(userBilling)
    .where(
      or(
        and(isNotNull(userBilling.compEntitlementUntil), gt(userBilling.compEntitlementUntil, new Date())),
        inArray(userBilling.subscriptionStatus, ['active', 'trialing', 'past_due']),
      ),
    )
  const [codeRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(promoCodes)
    .where(sql`is_active = 'true'`)
  const recentActions = await db
    .select()
    .from(adminActions)
    .orderBy(desc(adminActions.createdAt))
    .limit(10)

  return {
    users: userRow?.n ?? 0,
    books: bookRow?.n ?? 0,
    hives: hiveRow?.n ?? 0,
    premium: premiumRow?.n ?? 0,
    activeCodes: codeRow?.n ?? 0,
    recentActions,
  }
}

export default async function AdminDashboardPage() {
  await requireAdmin()
  const stats = await getStats()

  const tiles = [
    { label: 'Users', value: stats.users },
    { label: 'Premium users', value: stats.premium },
    { label: 'Books', value: stats.books },
    { label: 'Hives', value: stats.hives },
    { label: 'Active promo codes', value: stats.activeCodes },
  ]

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1
          className="font-bold text-3xl"
          style={{ fontFamily: 'var(--font-display, Comfortaa)', color: 'var(--brand)' }}
        >
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          Snapshot of the live system.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-[var(--r-card)] p-5"
            style={{
              background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
              boxShadow: 'var(--sh-tile)',
            }}
          >
            <div
              className="text-[10px] font-mono uppercase tracking-[0.14em]"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              {t.label}
            </div>
            <div
              className="text-3xl font-bold mt-1"
              style={{ color: 'var(--canvas-dark-ink-strong)' }}
            >
              {t.value.toLocaleString()}
            </div>
          </div>
        ))}
      </section>

      <section
        className="rounded-[var(--r-card)] p-6"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          boxShadow: 'var(--sh-card)',
          borderTop: 'var(--br-card)',
        }}
      >
        <h2
          className="font-bold text-lg mb-3"
          style={{ fontFamily: 'var(--font-display, Comfortaa)', color: 'var(--brand)' }}
        >
          Recent admin actions
        </h2>
        {stats.recentActions.length === 0 ? (
          <p
            className="text-sm italic"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            No actions yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y" style={{ borderColor: 'var(--canvas-dark-300)' }}>
            {stats.recentActions.map((a) => (
              <li
                key={a.id}
                className="py-2 text-sm grid gap-2"
                style={{
                  gridTemplateColumns: '160px 1fr 200px',
                  color: 'var(--canvas-dark-ink)',
                }}
              >
                <span
                  className="text-[10px] font-mono uppercase tracking-[0.14em]"
                  style={{ color: 'var(--canvas-dark-ink-muted)' }}
                >
                  {new Date(a.createdAt as unknown as string).toLocaleString()}
                </span>
                <span className="truncate">
                  <span style={{ color: 'var(--brand)' }}>{a.action}</span>
                  {a.targetType && (
                    <span style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                      {' '}
                      · {a.targetType} {a.targetId}
                    </span>
                  )}
                </span>
                <span
                  className="text-right text-[11px] truncate"
                  style={{ color: 'var(--canvas-dark-ink-muted)' }}
                >
                  {a.adminEmail}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
