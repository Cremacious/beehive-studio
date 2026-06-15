import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

type Props = {
  params: Promise<{ locale: string }>
}

export default async function SparksNewPage({ params }: Props) {
  const { locale } = await params
  const session = await auth.api.getSession({ headers: await headers() })

  // Guests get redirected to sign-in with ?next preserved so they land back
  // here after auth.
  if (!session?.user) {
    redirect(`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/sparks/new`)}`)
  }

  return (
    <main className="mx-auto w-full px-6 pt-7 pb-6" style={{ maxWidth: '640px' }}>
      <header className="mb-6">
        <h1
          className="text-[28px] font-bold leading-tight"
          style={{
            color: 'var(--canvas-dark-ink-strong)',
            fontFamily: 'var(--font-display)',
          }}
        >
          New Spark
        </h1>
        <p
          className="text-[13px] mt-1.5"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          Set a short title and the writing challenge. Other writers will submit entries to your prompt.
        </p>
      </header>

      {/* W4.2 wires in <CreateSparkForm /> here */}
      <div
        className="rounded-2xl p-6 text-[13px]"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          color: 'var(--canvas-dark-ink-muted)',
        }}
      >
        Form coming in W4.2.
      </div>
    </main>
  )
}
