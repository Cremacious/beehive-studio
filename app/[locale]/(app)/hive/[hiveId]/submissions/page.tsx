import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/require-auth'
import { listHiveSubmissionsAction } from '@/lib/actions/hive-submissions.actions'
import { requireHiveMember, canSubmitChapter } from '@/lib/hive/permissions'
import { HivePageShell } from '../_components/hive-page-shell'
import { SubmissionsList } from './_components/submissions-list'
import { SubmissionsExplainer } from './_components/submissions-explainer'

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
    <>
      {/* Mobile (issue #50) — full-width outside the shell. */}
      <div className="md:hidden flex flex-col gap-3 pt-3">
        {canSubmit && (
          <Link
            href={`/${locale}/hive/${hiveId}/submissions/new`}
            className="inline-flex w-full items-center justify-center gap-1.5 min-h-[42px] text-[13px] font-semibold no-underline"
            style={{ background: 'var(--brand)', color: 'var(--brand-ink)', borderRadius: 'var(--r-pill)', boxShadow: 'var(--sh-tile)' }}
          >
            <span aria-hidden>+</span> New submission
          </Link>
        )}
        <SubmissionsExplainer viewerRole={viewerRole} locale={locale} />
        <SubmissionsList
          hiveId={hiveId}
          locale={locale}
          viewerRole={viewerRole}
          myDrafts={r.data.myDrafts}
          mySubmissions={r.data.mySubmissions}
          allInHive={r.data.allInHive}
          mobile
        />
      </div>

      {/* Desktop — unchanged. */}
      <div className="max-md:hidden">
        <HivePageShell
          width="standard"
          title="Submissions"
          subtitle="Chapter drafts submitted for review."
          headerSlot={canSubmit ? <NewSubmissionCTA locale={locale} hiveId={hiveId} /> : undefined}
        >
          <SubmissionsExplainer viewerRole={viewerRole} locale={locale} />
          <SubmissionsList
            hiveId={hiveId}
            locale={locale}
            viewerRole={viewerRole}
            myDrafts={r.data.myDrafts}
            mySubmissions={r.data.mySubmissions}
            allInHive={r.data.allInHive}
          />
        </HivePageShell>
      </div>
    </>
  )
}
