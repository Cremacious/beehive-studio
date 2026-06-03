import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/require-auth'
import { getHiveChapterListAction } from '@/lib/actions/hive-content.actions'
import {
  requireHiveMember,
  canReviewSuggestion,
} from '@/lib/hive/permissions'
import { HivePageShell } from '../_components/hive-page-shell'
import { HiveChapterIndex } from './_components/hive-chapter-index'

export default async function HiveChaptersPage({
  params,
}: {
  params: Promise<{ hiveId: string; locale: string }>
}) {
  const { hiveId, locale } = await params
  const userId = await requireAuth()
  const role = await requireHiveMember(hiveId, userId)
  const canReview = canReviewSuggestion(role)
  const r = await getHiveChapterListAction(hiveId)
  if (!r.success) notFound()
  const count = r.data.chapters.length
  return (
    <HivePageShell
      width="standard"
      title="Chapters"
      subtitle={`${count} ${count === 1 ? 'chapter' : 'chapters'}`}
    >
      <HiveChapterIndex
        hiveId={hiveId}
        locale={locale}
        chapters={r.data.chapters}
        canReview={canReview}
      />
    </HivePageShell>
  )
}
