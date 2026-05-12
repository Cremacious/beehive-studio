import { notFound } from 'next/navigation'
import { getHiveOutlineAction } from '@/lib/actions/hive-content.actions'
import { getHiveAction } from '@/lib/actions/hive.actions'
import { HiveOutlineEditor } from '../_components/hive-outline-editor'

export default async function HiveOutlinePage({ params }: { params: Promise<{ hiveId: string; locale: string }> }) {
  const { hiveId } = await params
  const [hiveResult, outlineResult] = await Promise.all([
    getHiveAction(hiveId).catch(() => null),
    getHiveOutlineAction(hiveId).catch(() => ({ success: true as const, data: { content: null } })),
  ])
  if (!hiveResult?.success) notFound()
  return (
    <HiveOutlineEditor
      hiveId={hiveId}
      initialContent={outlineResult?.success ? outlineResult.data.content : null}
    />
  )
}
