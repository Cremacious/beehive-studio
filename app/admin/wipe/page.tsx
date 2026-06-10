import { requireAdmin } from '@/lib/admin/require-admin'
import { notFound } from 'next/navigation'
import { WipeForm } from './wipe-form'

export const dynamic = 'force-dynamic'

export default async function AdminWipePage() {
  await requireAdmin()
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <header>
        <h1
          className="font-bold text-3xl"
          style={{ fontFamily: 'var(--font-display, Comfortaa)', color: 'oklch(0.72 0.2 25)' }}
        >
          Wipe database
        </h1>
        <p
          className="text-sm mt-1"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          Dev-only nuclear option. Truncates every app table and starts from
          scratch.
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
          className="font-bold text-base mb-2"
          style={{ color: 'var(--canvas-dark-ink-strong)' }}
        >
          What this does
        </h2>
        <ul
          className="text-sm list-disc pl-5 space-y-1"
          style={{ color: 'var(--canvas-dark-ink)' }}
        >
          <li>TRUNCATE every app table with RESTART IDENTITY CASCADE.</li>
          <li>Deletes all users, books, sparks, hives, clubs, comments, follows, social activity.</li>
          <li>Keeps your schema, drizzle migrations, and promo code definitions.</li>
          <li>Logs the action in admin_actions before and after.</li>
        </ul>
        <h2
          className="font-bold text-base mt-5 mb-2"
          style={{ color: 'var(--canvas-dark-ink-strong)' }}
        >
          What this does NOT do
        </h2>
        <ul
          className="text-sm list-disc pl-5 space-y-1"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          <li>Delete Stripe test customers (they'll orphan; delete in the Stripe dashboard if needed).</li>
          <li>Delete Cloudinary uploads (covers, avatars).</li>
          <li>Reset env, sessions in better-auth memory, or caches.</li>
        </ul>
      </section>

      <section
        className="rounded-[var(--r-card)] p-6"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          boxShadow: 'var(--sh-card)',
          borderTop: '2px solid oklch(0.72 0.2 25 / 0.6)',
        }}
      >
        <WipeForm />
      </section>
    </div>
  )
}
