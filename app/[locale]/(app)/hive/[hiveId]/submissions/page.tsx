import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/require-auth'
import { listHiveSubmissionsAction } from '@/lib/actions/hive-submissions.actions'
import { requireHiveMember } from '@/lib/hive/permissions'
import { SubmissionsList } from './_components/submissions-list'

export default async function SubmissionsPage({
  params,
}: {
  params: Promise<{ hiveId: string; locale: string }>
}) {
  const { hiveId, locale } = await params
  const userId = await requireAuth()

  let viewerRole
  try {
    viewerRole = await requireHiveMember(hiveId, userId)
  } catch {
    notFound()
  }

  const r = await listHiveSubmissionsAction(hiveId)
  if (!r.success) notFound()

  return (
    <SubmissionsList
      hiveId={hiveId}
      locale={locale}
      viewerRole={viewerRole}
      myDrafts={r.data.myDrafts}
      mySubmissions={r.data.mySubmissions}
      allInHive={r.data.allInHive}
    />
  )
}
