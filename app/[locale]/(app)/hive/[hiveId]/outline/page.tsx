import { notFound } from 'next/navigation'
import { getHiveOutlineView } from '@/lib/actions/hive-content.actions'
import { HiveOutlineSurface } from './_components/hive-outline-surface'

export default async function HiveOutlinePage({ params }: { params: Promise<{ hiveId: string; locale: string }> }) {
  const { hiveId, locale } = await params
  const r = await getHiveOutlineView(hiveId)
  if (!r.success) notFound()

  // Interim shape bridge — T9 replaces this page with a proper index.
  // Show the first outline if any exist; otherwise show an inline empty state.
  if (r.data.outlines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <p className="text-sm text-[var(--canvas-dark-ink-muted)] italic text-center">
          No outlines yet — the author can create one in the studio.
        </p>
      </div>
    )
  }

  return (
    <HiveOutlineSurface
      data={{
        bookId: r.data.bookId,
        entry: r.data.outlines[0]!,
        chapters: r.data.chapters,
        viewerRole: r.data.viewerRole,
      }}
      hiveId={hiveId}
      locale={locale}
    />
  )
}
