import { notFound } from 'next/navigation'
import { getHiveOutlineByIdAction } from '@/lib/actions/hive-content.actions'
import { HivePageShell } from '../../_components/hive-page-shell'
import { HiveOutlineSurface } from '../_components/hive-outline-surface'

export default async function HiveOutlineDetailPage({
  params,
}: {
  params: Promise<{ hiveId: string; outlineId: string; locale: string }>
}) {
  const { hiveId, outlineId, locale } = await params
  const r = await getHiveOutlineByIdAction(hiveId, outlineId)
  if (!r.success) notFound()

  const bookId = r.data.entry.outline.bookId

  // Title + subtitle render inside HiveOutlineSurface so the title is
  // user-editable (contenteditable h1 wired to updateBinderItemAction).
  // Shell renders only the "← Back to outlines" mono breadcrumb above the panel.
  return (
    <HivePageShell
      width="wide"
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
