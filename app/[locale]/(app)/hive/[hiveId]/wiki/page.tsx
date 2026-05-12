import { notFound } from 'next/navigation'
import { getHiveAction } from '@/lib/actions/hive.actions'
import { getWikiPagesAction } from '@/lib/actions/hive-content.actions'
import { HiveWiki } from '../_components/hive-wiki'

export default async function HiveWikiPage({ params }: { params: Promise<{ hiveId: string }> }) {
  const { hiveId } = await params
  const [hiveResult, pagesResult] = await Promise.all([
    getHiveAction(hiveId).catch(() => null),
    getWikiPagesAction(hiveId).catch(() => null),
  ])
  if (!hiveResult?.success) notFound()
  return <HiveWiki hiveId={hiveId} pages={pagesResult?.success ? pagesResult.data : []} activePage={null} />
}
