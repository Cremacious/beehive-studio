import { notFound } from 'next/navigation'
import { getHiveOutlineView } from '@/lib/actions/hive-content.actions'
import { OutlineIndex } from './_components/outline-index'

export default async function HiveOutlineIndexPage({
  params,
}: {
  params: Promise<{ hiveId: string; locale: string }>
}) {
  const { hiveId, locale } = await params
  const r = await getHiveOutlineView(hiveId)
  if (!r.success) notFound()

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <OutlineIndex
          outlines={r.data.outlines}
          hiveId={hiveId}
          locale={locale}
        />
      </div>
    </main>
  )
}
