import { requireAdmin } from '@/lib/admin/require-admin'
import { db } from '@/db'
import { adminActions } from '@/db/schema'
import { desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export default async function AdminAuditPage() {
  await requireAdmin()
  const rows = await db.select().from(adminActions).orderBy(desc(adminActions.createdAt)).limit(500)

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1
          className="font-bold text-3xl"
          style={{ fontFamily: 'var(--font-display, Comfortaa)', color: 'var(--brand)' }}
        >
          Audit log
        </h1>
        <p
          className="text-sm mt-1"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          Last 500 admin actions, newest first.
        </p>
      </header>

      <div
        className="rounded-[var(--r-card)] overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          boxShadow: 'var(--sh-card)',
          borderTop: 'var(--br-card)',
        }}
      >
        <div
          className="grid px-5 py-2.5 text-[10px] font-mono uppercase tracking-[0.14em]"
          style={{
            gridTemplateColumns: '170px 1fr 220px 200px',
            background: 'var(--canvas-dark-100)',
            color: 'var(--canvas-dark-ink-muted)',
            borderBottom: 'var(--br-card)',
          }}
        >
          <span>When</span>
          <span>Action</span>
          <span>Target</span>
          <span>Admin</span>
        </div>
        {rows.length === 0 ? (
          <p
            className="px-5 py-6 text-sm italic"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            No actions yet.
          </p>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--canvas-dark-300)' }}>
            {rows.map((a) => (
              <li
                key={a.id}
                className="grid px-5 py-2 text-sm items-center"
                style={{
                  gridTemplateColumns: '170px 1fr 220px 200px',
                  color: 'var(--canvas-dark-ink)',
                }}
              >
                <span style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                  {new Date(a.createdAt as unknown as string).toLocaleString()}
                </span>
                <span style={{ color: 'var(--brand)' }} className="truncate">
                  {a.action}
                </span>
                <span className="truncate" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                  {a.targetType ? `${a.targetType} · ${a.targetId ?? '–'}` : '–'}
                </span>
                <span className="truncate" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                  {a.adminEmail}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
