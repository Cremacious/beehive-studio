import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin/require-admin'
import { LoginForm } from './login-form'

export const dynamic = 'force-dynamic'

export default async function AdminLoginPage() {
  const session = await getAdminSession()
  if (session) redirect('/admin')

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: '#262728' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-7"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          boxShadow: 'var(--sh-card)',
          borderTop: 'var(--br-card)',
        }}
      >
        <h1
          className="font-bold text-2xl mb-1"
          style={{ fontFamily: 'var(--font-display, Comfortaa)', color: 'var(--brand)' }}
        >
          Admin
        </h1>
        <p
          className="text-sm mb-6"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          Sign in with your admin credentials.
        </p>
        <LoginForm />
      </div>
    </main>
  )
}
