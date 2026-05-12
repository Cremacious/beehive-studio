import { notFound } from 'next/navigation'
import { getWikiPagesAction, getWikiPageAction } from '@/lib/actions/hive-content.actions'
import { getHiveAction } from '@/lib/actions/hive.actions'
import { HiveWiki } from '../../_components/hive-wiki'

export default async function WikiPageDetail({ params }: { params: Promise<{ hiveId: string; pageId: string }> }) {
  const { hiveId, pageId } = await params
  const [hiveResult, pagesResult, pageResult] = await Promise.all([
    getHiveAction(hiveId).catch(() => null),
    getWikiPagesAction(hiveId).catch(() => null),
    getWikiPageAction(pageId).catch(() => null),
  ])
  if (!hiveResult?.success || !pageResult?.success) notFound()
  return <HiveWiki hiveId={hiveId} pages={pagesResult?.success ? pagesResult.data : []} activePage={pageResult.data} />
}
