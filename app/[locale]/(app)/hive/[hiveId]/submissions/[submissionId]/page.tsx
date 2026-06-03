import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/require-auth'
import { getSubmissionAction } from '@/lib/actions/hive-submissions.actions'
import { getHiveChapterListAction } from '@/lib/actions/hive-content.actions'
import { requireHiveMember, canReviewSubmissions } from '@/lib/hive/permissions'
import { HivePageShell } from '../../_components/hive-page-shell'
import { SubmissionComposer } from '../_components/submission-composer'
import { SubmissionReview } from '../_components/submission-review'
import { SubmissionRead } from '../_components/submission-read'

export default async function SubmissionDynamicPage({
  params,
}: {
  params: Promise<{ hiveId: string; locale: string; submissionId: string }>
}) {
  const { hiveId, locale, submissionId } = await params
  const userId = await requireAuth()

  const r = await getSubmissionAction(submissionId)
  if (!r.success) notFound()

  let viewerRole
  try {
    viewerRole = await requireHiveMember(hiveId, userId)
  } catch {
    notFound()
  }

  const { submission, submitter, book } = r.data
  const isOwner = submission.userId === userId
  const canReview = canReviewSubmissions(viewerRole)

  if (submission.draftStatus === 'DRAFT' && isOwner) {
    const chaptersResult = await getHiveChapterListAction(hiveId)
    const chapters = chaptersResult.success ? chaptersResult.data.chapters : []
    return (
      <HivePageShell
        width="standard"
        title={submission.title || 'Untitled submission'}
        subtitle="Auto-saves as you type."
        back={{ href: `/${locale}/hive/${hiveId}/submissions`, label: 'submissions' }}
      >
        <SubmissionComposer
          mode="existing"
          hiveId={hiveId}
          locale={locale}
          chapters={chapters}
          initial={{
            id: submission.id,
            title: submission.title,
            content: submission.content,
            targetChapterOrder: submission.targetChapterOrder,
            wordCount: submission.wordCount,
            draftStatus: submission.draftStatus,
          }}
        />
      </HivePageShell>
    )
  }

  if (submission.draftStatus === 'PENDING' && canReview) {
    return (
      <SubmissionReview
        submission={submission}
        submitter={submitter}
        book={book}
        hiveId={hiveId}
        locale={locale}
      />
    )
  }

  return (
    <SubmissionRead
      submission={submission}
      submitter={submitter}
      book={book}
      hiveId={hiveId}
      locale={locale}
    />
  )
}
