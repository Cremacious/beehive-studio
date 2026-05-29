import { notFound } from 'next/navigation'
import { getHiveOutlineView } from '@/lib/actions/hive-content.actions'
import { HiveOutlineSurface } from './_components/hive-outline-surface'

export default async function HiveOutlinePage({ params }: { params: Promise<{ hiveId: string; locale: string }> }) {
  const { hiveId, locale } = await params
  const r = await getHiveOutlineView(hiveId)
  if (!r.success) notFound()
  return <HiveOutlineSurface data={r.data} hiveId={hiveId} locale={locale} />
}
