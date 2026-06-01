import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/require-auth'
import { getHiveChapterView } from '@/lib/actions/hive-content.actions'
import { HiveChapterSurface } from './_components/hive-chapter-surface'

export default async function HiveChapterPage({
  params,
}: {
  params: Promise<{ hiveId: string; chapterId: string; locale: string }>
}) {
  const { hiveId, chapterId, locale } = await params
  const userId = await requireAuth()
  const r = await getHiveChapterView(hiveId, chapterId)
  if (!r.success) notFound()
  return (
    <HiveChapterSurface
      data={r.data}
      hiveId={hiveId}
      chapterId={chapterId}
      locale={locale}
      viewerUserId={userId}
    />
  )
}
