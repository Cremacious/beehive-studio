import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/require-auth'
import { getHiveChapterListAction } from '@/lib/actions/hive-content.actions'
import { requireHiveMember } from '@/lib/hive/permissions'
import { HivePageShell } from '../_components/hive-page-shell'
import { HiveChapterIndex } from './_components/hive-chapter-index'

export default async function HiveChaptersPage({
  params,
}: {
  params: Promise<{ hiveId: string; locale: string }>
}) {
  const { hiveId, locale } = await params
  const userId = await requireAuth()
  await requireHiveMember(hiveId, userId)
  const r = await getHiveChapterListAction(hiveId)
  if (!r.success) notFound()
  const count = r.data.chapters.length
  return (
    <>
      {/* Mobile (issue #50, variant C) — outside the shell for full width. */}
      <div className="md:hidden pt-3">
        <HiveChapterIndex hiveId={hiveId} locale={locale} chapters={r.data.chapters} mobile />
      </div>

      {/* Desktop — unchanged. */}
      <div className="max-md:hidden">
        <HivePageShell
          width="standard"
          title="Chapters"
          subtitle={`${count} ${count === 1 ? 'chapter' : 'chapters'}`}
        >
          <HiveChapterIndex
            hiveId={hiveId}
            locale={locale}
            chapters={r.data.chapters}
          />
        </HivePageShell>
      </div>
    </>
  )
}
