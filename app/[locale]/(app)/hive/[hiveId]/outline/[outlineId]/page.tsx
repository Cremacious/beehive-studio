import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getHiveOutlineByIdAction } from '@/lib/actions/hive-content.actions'
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

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Link
          href={`/${locale}/hive/${hiveId}/outline`}
          className="inline-flex items-center gap-1.5 text-xs font-mono mb-4 hover:text-[var(--brand)]"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          <ArrowLeft size={12} />
          Back to outlines
        </Link>
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
      </div>
    </main>
  )
}
