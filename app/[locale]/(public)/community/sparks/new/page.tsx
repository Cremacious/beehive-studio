import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { CreateSparkForm } from './_components/create-spark-form'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ prompt?: string; wordLimit?: string }>
}

export default async function SparksNewPage({ params, searchParams }: Props) {
  const [{ locale }, sp] = await Promise.all([params, searchParams])
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    redirect(`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/community/sparks/new`)}`)
  }

  const defaultWordLimit = sp.wordLimit ? parseInt(sp.wordLimit, 10) : undefined
  const safeWordLimit =
    defaultWordLimit && Number.isFinite(defaultWordLimit) && defaultWordLimit > 0
      ? defaultWordLimit
      : undefined

  return (
    <main className="mx-auto w-full px-6 pt-7 pb-24" style={{ maxWidth: '720px' }}>
      <div className="mb-6">
        <Link
          href={`/${locale}/community/sparks`}
          className="text-[12px] transition-colors"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          &larr; Sparks
        </Link>
        <h1
          className="text-[28px] font-bold leading-tight mt-3"
          style={{ color: 'var(--brand)', fontFamily: 'var(--font-display)' }}
        >
          New Spark
        </h1>
        <p className="text-[13px] mt-1.5" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          Set a title and a writing challenge. Other writers will submit entries to your prompt.
        </p>
      </div>

      <CreateSparkForm
        locale={locale}
        defaultPrompt={sp.prompt}
        defaultWordLimit={safeWordLimit}
      />
    </main>
  )
}
