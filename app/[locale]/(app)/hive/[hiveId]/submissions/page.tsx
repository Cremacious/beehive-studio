import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/require-auth'
import { listHiveSubmissionsAction } from '@/lib/actions/hive-submissions.actions'
import { requireHiveMember, canSubmitChapter } from '@/lib/hive/permissions'
import { HivePageShell } from '../_components/hive-page-shell'
import { SubmissionsList } from './_components/submissions-list'

function NewSubmissionCTA({ locale, hiveId }: { locale: string; hiveId: string }) {
  return (
    <Link
      href={`/${locale}/hive/${hiveId}/submissions/new`}
      style={{
        background: 'var(--brand)',
        color: 'var(--brand-ink)',
        borderRadius: 'var(--r-pill)',
        boxShadow: 'var(--sh-tile)',
      }}
      className="px-4 py-2 text-[13px] font-semibold"
    >
      + New Submission
    </Link>
  )
}

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

  const canSubmit = canSubmitChapter(viewerRole)

  return (
    <HivePageShell
      width="standard"
      title="Submissions"
      subtitle="Chapter drafts submitted for review."
      headerSlot={canSubmit ? <NewSubmissionCTA locale={locale} hiveId={hiveId} /> : undefined}
    >
      <SubmissionsList
        hiveId={hiveId}
        locale={locale}
        viewerRole={viewerRole}
        myDrafts={r.data.myDrafts}
        mySubmissions={r.data.mySubmissions}
        allInHive={r.data.allInHive}
      />
    </HivePageShell>
  )
}
