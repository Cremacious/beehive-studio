import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/require-auth'
import { requireHiveMember, canReviewSuggestion } from '@/lib/hive/permissions'
import { getPendingSuggestionsForHiveAction } from '@/lib/actions/hive-suggestions.actions'
import { HivePageShell } from '../_components/hive-page-shell'
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
      <HivePageShell
        width="standard"
        title="Edit Suggestions"
        subtitle="Review pending suggestions across this hive's chapters."
      >
        <ComingSoon
          title="Edit Suggestions"
          phase="Suggestion review is for hive owners and moderators."
        />
      </HivePageShell>
    )
  }

  const r = await getPendingSuggestionsForHiveAction(hiveId)
  if (!r.success) notFound()

  const totalPending = r.data.reduce((sum, g) => sum + g.suggestions.length, 0)
  const chapterCount = r.data.length
  const subtitle =
    totalPending === 0
      ? 'No pending suggestions.'
      : `${totalPending} pending across ${chapterCount} ${chapterCount === 1 ? 'chapter' : 'chapters'}`

  return (
    <HivePageShell width="standard" title="Edit Suggestions" subtitle={subtitle}>
      <SuggestionsByChapter data={r.data} hiveId={hiveId} locale={locale} />
    </HivePageShell>
  )
}
