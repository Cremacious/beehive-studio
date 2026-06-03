import { notFound } from 'next/navigation'
import { getHiveOutlineView } from '@/lib/actions/hive-content.actions'
import { HivePageShell } from '../_components/hive-page-shell'
import { OutlineIndex } from './_components/outline-index'

export default async function HiveOutlineIndexPage({
  params,
}: {
  params: Promise<{ hiveId: string; locale: string }>
}) {
  const { hiveId, locale } = await params
  const r = await getHiveOutlineView(hiveId)
  if (!r.success) notFound()

  const count = r.data.outlines.length
  const subtitle = `${count} ${count === 1 ? 'outline' : 'outlines'} in this hive`

  return (
    <HivePageShell width="wide" title="Outlines" subtitle={subtitle}>
      <OutlineIndex
        outlines={r.data.outlines}
        hiveId={hiveId}
        locale={locale}
      />
    </HivePageShell>
  )
}
