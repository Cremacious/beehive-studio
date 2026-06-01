import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/require-auth'
import { getHiveChapterListAction } from '@/lib/actions/hive-content.actions'
import { HiveChapterIndex } from './_components/hive-chapter-index'

export default async function HiveChaptersPage({
  params,
}: {
  params: Promise<{ hiveId: string; locale: string }>
}) {
  const { hiveId, locale } = await params
  await requireAuth()
  const r = await getHiveChapterListAction(hiveId)
  if (!r.success) notFound()
  return (
    <HiveChapterIndex
      hiveId={hiveId}
      locale={locale}
      chapters={r.data.chapters}
    />
  )
}
