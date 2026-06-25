import Link from 'next/link'
import { getAdminSession } from '@/lib/admin/require-admin'
import { adminLogoutAction } from './login/actions'

export const dynamic = 'force-dynamic'

const NAV: { href: string; label: string; devOnly?: boolean }[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/promo-codes', label: 'Promo Codes' },
  { href: '/admin/content', label: 'Content' },
  { href: '/admin/audit', label: 'Audit log' },
  { href: '/admin/support', label: 'Support' },
  { href: '/admin/wipe', label: 'Wipe DB', devOnly: true },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession()

  // When no admin session, render bare — the login page provides its own
  // full-screen shell. Avoids nested <main> and unwanted padding.
  if (!session) {
    return <>{children}</>
  }

  const isDev = process.env.NODE_ENV !== 'production'
  const entries = NAV.filter((n) => !n.devOnly || isDev)

  return (
    <div className="min-h-screen flex" style={{ background: '#262728' }}>
      <aside
        className="w-60 shrink-0 px-4 py-6 flex flex-col gap-2"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRight: 'var(--br-card)',
        }}
      >
        <div className="px-2 mb-4">
          <div
            className="font-bold text-lg"
            style={{ fontFamily: 'var(--font-display, Comfortaa)', color: 'var(--brand)' }}
          >
            Beehive Admin
          </div>
          <div
            className="text-[10px] font-mono uppercase tracking-[0.14em] mt-0.5 truncate"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            {session.email}
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {entries.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="px-3 py-2 rounded-[var(--r-row)] text-sm transition-colors hover:brightness-110"
              style={{
                color: 'var(--canvas-dark-ink)',
              }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <form action={adminLogoutAction} className="mt-auto px-2">
          <button
            type="submit"
            className="text-xs underline"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            Sign out
          </button>
        </form>
      </aside>
      <main className="flex-1 min-w-0 px-8 py-6">{children}</main>
    </div>
  )
}
