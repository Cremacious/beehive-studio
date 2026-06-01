import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/require-auth'
import { requireHiveMember, canReviewSuggestion } from '@/lib/hive/permissions'
import { getPendingSuggestionsForHiveAction } from '@/lib/actions/hive-suggestions.actions'
import { ComingSoon } from '../_components/coming-soon'
import { SuggestionsByChapter } from './_components/suggestions-by-chapter'

export default async function SuggestionsPage({
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

  if (!canReviewSuggestion(role)) {
    return (
      <ComingSoon
        title="Edit Suggestions"
        phase="Suggestion review is for hive owners and moderators."
      />
    )
  }

  const r = await getPendingSuggestionsForHiveAction(hiveId)
  if (!r.success) notFound()

  return <SuggestionsByChapter data={r.data} hiveId={hiveId} locale={locale} />
}
