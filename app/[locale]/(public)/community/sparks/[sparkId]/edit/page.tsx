import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getSparkForEditAction } from '@/lib/actions/sparks.actions'
import { SparkForm } from '../../_components/spark-form'

type Props = {
  params: Promise<{ locale: string; sparkId: string }>
}

export default async function SparkEditPage({ params }: Props) {
  const { locale, sparkId } = await params
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    redirect(
      `/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/community/sparks/${sparkId}/edit`)}`,
    )
  }

  const result = await getSparkForEditAction(sparkId)

  if (!result.success) {
    if (result.error === 'NOT_FOUND') notFound()
    // NOT_AUTHORIZED masquerades as NOT_FOUND
    notFound()
  }

  const editData = result.data

  return (
    <main className="mx-auto w-full px-6 pt-7 pb-24" style={{ maxWidth: '720px' }}>
      <div className="mb-6">
        <Link
          href={`/${locale}/community/sparks/${sparkId}`}
          className="text-[12px] transition-colors"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          &larr; Back to Spark
        </Link>
        <h1
          className="text-[28px] font-bold leading-tight mt-3"
          style={{ color: 'var(--brand)', fontFamily: 'var(--font-display)' }}
        >
          Edit Spark
        </h1>
        <p className="text-[13px] mt-1.5" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          {editData.status === 'CLOSED'
            ? 'This Spark has ended and can no longer be edited.'
            : editData.status === 'VOTING'
            ? 'Voting is in progress. The deadline cannot be changed, but other fields can still be updated.'
            : 'Changes take effect immediately.'}
        </p>
      </div>

      {editData.status === 'CLOSED' ? (
        <div
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            borderRadius: 'var(--r-card)',
            boxShadow: 'var(--sh-card)',
            borderTop: 'var(--br-card)',
            padding: 32,
            textAlign: 'center',
          }}
        >
          <p style={{ color: 'var(--canvas-dark-ink-muted)', fontSize: 14 }}>
            This Spark has ended and cannot be edited.
          </p>
          <Link
            href={`/${locale}/community/sparks/${sparkId}`}
            style={{
              display: 'inline-block',
              marginTop: 16,
              padding: '8px 20px',
              borderRadius: 'var(--r-pill)',
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            View Spark
          </Link>
        </div>
      ) : (
        <SparkForm
          locale={locale}
          mode="edit"
          sparkId={sparkId}
          editData={editData}
        />
      )}
    </main>
  )
}
