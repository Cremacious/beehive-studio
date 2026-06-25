import Link from 'next/link'
import { Compass } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#262728] px-6">
      <div
        className="w-full max-w-md rounded-[var(--r-card)] p-8 text-center"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          boxShadow: 'var(--sh-card)',
          borderTop: '1px solid var(--br-card)',
        }}
      >
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            boxShadow: 'var(--sh-tile)',
          }}
        >
          <Compass className="h-6 w-6 text-[var(--brand)]" />
        </div>
        <h1 className="mb-2 font-comfortaa text-3xl font-bold text-[var(--brand)]">404</h1>
        <p className="mb-6 text-sm text-[var(--canvas-dark-ink)]">
          We couldn&apos;t find that page. It may have moved or never existed.
        </p>
        <Link
          href="/"
          className="inline-block rounded-[var(--r-btn)] bg-[var(--brand)] px-5 py-2 text-sm font-semibold text-[var(--brand-ink)] hover:brightness-110"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
