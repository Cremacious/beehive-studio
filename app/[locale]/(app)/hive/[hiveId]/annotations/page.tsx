import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/require-auth'
import { getAnnotationsForHiveAction } from '@/lib/actions/hive-annotations.actions'
import { AnnotationsByChapter } from './_components/annotations-by-chapter'

export default async function AnnotationsPage({
  params,
}: {
  params: Promise<{ hiveId: string; locale: string }>
}) {
  const { hiveId, locale } = await params
  await requireAuth()

  const r = await getAnnotationsForHiveAction(hiveId, { includeResolved: true })
  if (!r.success) notFound()

  return <AnnotationsByChapter data={r.data} hiveId={hiveId} locale={locale} />
}
