import Link from 'next/link'
import { UserX } from 'lucide-react'

type Props = {
  locale: string
}

export function ProfileUnavailable({ locale }: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#262728] px-6">
      <div
        className="max-w-md rounded-[var(--r-card)] p-8 text-center"
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
          <UserX className="h-6 w-6 text-[var(--brand)]" />
        </div>
        <h1 className="mb-2 font-comfortaa text-xl font-bold text-[var(--brand)]">
          This profile is unavailable
        </h1>
        <p className="mb-6 text-sm text-[var(--canvas-dark-ink)]">
          We couldn&apos;t find a profile here.
        </p>
        <Link
          href={`/${locale}/discover`}
          className="inline-block rounded-[var(--r-btn)] bg-[var(--brand)] px-5 py-2 text-sm font-semibold text-[var(--brand-ink)] hover:brightness-110"
        >
          Discover writers
        </Link>
      </div>
    </div>
  )
}
