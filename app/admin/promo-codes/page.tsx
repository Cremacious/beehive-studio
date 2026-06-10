import { requireAdmin } from '@/lib/admin/require-admin'
import { db } from '@/db'
import { promoCodes } from '@/db/schema'
import { desc } from 'drizzle-orm'
import { CreateCodeForm } from './create-code-form'
import { CodeRow } from './code-row'

export const dynamic = 'force-dynamic'

export default async function AdminPromoCodesPage() {
  await requireAdmin()
  const codes = await db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt))

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1
          className="font-bold text-3xl"
          style={{ fontFamily: 'var(--font-display, Comfortaa)', color: 'var(--brand)' }}
        >
          Promo Codes
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          Codes grant temporary or lifetime premium when redeemed at <code>/redeem</code>.
        </p>
      </header>

      <section
        className="rounded-[var(--r-card)] p-6"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          boxShadow: 'var(--sh-card)',
          borderTop: 'var(--br-card)',
        }}
      >
        <h2
          className="font-bold text-lg mb-4"
          style={{ fontFamily: 'var(--font-display, Comfortaa)', color: 'var(--brand)' }}
        >
          Create a new code
        </h2>
        <CreateCodeForm />
      </section>

      <section
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
            gridTemplateColumns: '1.2fr 0.7fr 0.7fr 0.9fr 1.2fr 0.8fr',
            background: 'var(--canvas-dark-100)',
            color: 'var(--canvas-dark-ink-muted)',
            borderBottom: 'var(--br-card)',
          }}
        >
          <span>Code</span>
          <span>Kind</span>
          <span>Uses</span>
          <span>Status</span>
          <span>Note</span>
          <span className="text-right">Actions</span>
        </div>
        {codes.length === 0 ? (
          <p
            className="px-5 py-6 text-sm italic"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            No codes yet. Create one above.
          </p>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--canvas-dark-300)' }}>
            {codes.map((c) => (
              <CodeRow
                key={c.id}
                row={{
                  id: c.id,
                  code: c.code,
                  kind: c.kind as 'DAYS_30' | 'DAYS_90' | 'DAYS_365' | 'LIFETIME',
                  note: c.note,
                  maxUses: c.maxUses,
                  usesCount: c.usesCount,
                  isActive: c.isActive === 'true',
                  createdAt:
                    c.createdAt instanceof Date
                      ? c.createdAt.toISOString()
                      : String(c.createdAt),
                }}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
