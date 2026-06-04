import { notFound } from 'next/navigation'
import { getHiveWikiView } from '@/lib/actions/hive-content.actions'
import { HiveWikiShell } from './_components/hive-wiki-shell'

export default async function HiveWikiPage({ params }: { params: Promise<{ hiveId: string; locale: string }> }) {
  const { hiveId, locale } = await params
  const wiki = await getHiveWikiView(hiveId)
  if (!wiki.success) notFound()
  return (
    <HiveWikiShell
      hiveId={hiveId}
      locale={locale}
      bookId={wiki.data.bookId}
      counts={wiki.data.counts}
      viewerRole={wiki.data.viewerRole}
    />
  )
}
