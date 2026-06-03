import { notFound, redirect } from 'next/navigation'
import { requireAuth } from '@/lib/require-auth'
import { requireHiveMember, canSubmitChapter } from '@/lib/hive/permissions'
import { getHiveChapterListAction } from '@/lib/actions/hive-content.actions'
import { HivePageShell } from '../../_components/hive-page-shell'
import { SubmissionComposer } from '../_components/submission-composer'

export default async function NewSubmissionPage({
  params,
}: {
  params: Promise<{ hiveId: string; locale: string }>
}) {
  const { hiveId, locale } = await params
  const userId = await requireAuth()

  let role
  try {
    role = await requireHiveMember(hiveId, userId)
  } catch {
    notFound()
  }
  if (!canSubmitChapter(role)) {
    redirect(`/${locale}/hive/${hiveId}/submissions`)
  }

  const r = await getHiveChapterListAction(hiveId)
  if (!r.success) notFound()

  return (
    <HivePageShell
      width="standard"
      title="New submission"
      subtitle="Auto-saves as you type."
      back={{ href: `/${locale}/hive/${hiveId}/submissions`, label: 'submissions' }}
    >
      <SubmissionComposer
        mode="new"
        hiveId={hiveId}
        locale={locale}
        chapters={r.data.chapters}
      />
    </HivePageShell>
  )
}
