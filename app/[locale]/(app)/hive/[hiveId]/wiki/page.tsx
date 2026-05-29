import { notFound } from 'next/navigation'
import { getHiveWikiView, getHiveNotesView } from '@/lib/actions/hive-content.actions'
import { HiveWikiShell } from './_components/hive-wiki-shell'

export default async function HiveWikiPage({ params }: { params: Promise<{ hiveId: string; locale: string }> }) {
  const { hiveId, locale } = await params
  const [wiki, notes] = await Promise.all([
    getHiveWikiView(hiveId),
    getHiveNotesView(hiveId),
  ])
  if (!wiki.success || !notes.success) notFound()
  return <HiveWikiShell wiki={wiki.data} notes={notes.data} hiveId={hiveId} locale={locale} />
}
