import { notFound } from 'next/navigation'
import { getHiveOutlineByIdAction } from '@/lib/actions/hive-content.actions'
import { HivePageShell } from '../../_components/hive-page-shell'
import { HiveOutlineSurface } from '../_components/hive-outline-surface'

function relTime(d: Date): string {
  const seconds = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default async function HiveOutlineDetailPage({
  params,
}: {
  params: Promise<{ hiveId: string; outlineId: string; locale: string }>
}) {
  const { hiveId, outlineId, locale } = await params
  const r = await getHiveOutlineByIdAction(hiveId, outlineId)
  if (!r.success) notFound()

  const bookId = r.data.entry.outline.bookId
  const title = r.data.entry.outline.title || 'Untitled outline'
  const editedBy = r.data.entry.lastEditedByUsername
  const editedAt = r.data.entry.lastEditedAt
  const subtitle = editedAt
    ? editedBy
      ? `Last edited by @${editedBy} · ${relTime(editedAt)}`
      : `Last edited ${relTime(editedAt)}`
    : undefined

  return (
    <HivePageShell
      width="wide"
      title={title}
      subtitle={subtitle}
      back={{ href: `/${locale}/hive/${hiveId}/outline`, label: 'outlines' }}
    >
      <HiveOutlineSurface
        data={{
          bookId,
          entry: r.data.entry,
          chapters: r.data.chapters,
          viewerRole: r.data.viewerRole,
        }}
        hiveId={hiveId}
        locale={locale}
      />
    </HivePageShell>
  )
}
