import { notFound } from 'next/navigation'
import { getHiveAction } from '@/lib/actions/hive.actions'
import { getActiveWordGoalSummaryAction } from '@/lib/actions/hive-word-goals.actions'
import { HiveSidebar } from './_components/hive-sidebar'

export default async function HiveLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string; hiveId: string }>
}) {
  const { locale, hiveId } = await params
  const result = await getHiveAction(hiveId).catch(() => null)
  if (!result?.success) notFound()

  const { hive } = result.data

  const summaryRes = await getActiveWordGoalSummaryAction(hiveId).catch(() => null)
  let wordGoalPct: number | null = null
  if (summaryRes && summaryRes.success && summaryRes.data) {
    const { goal, progress } = summaryRes.data
    wordGoalPct = goal.targetWords > 0 ? (progress / goal.targetWords) * 100 : 0
  }

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-150), var(--canvas-dark-100))',
      }}
      className="flex gap-4 px-4 py-4 h-[calc(100vh-68px)] overflow-hidden max-md:flex-col max-md:h-auto max-md:overflow-visible max-md:px-3"
    >
      <HiveSidebar
        hiveId={hiveId}
        locale={locale}
        hiveName={hive.name}
        wordGoalPct={wordGoalPct}
      />
      <main className="flex-1 min-w-0 overflow-y-auto max-md:overflow-visible">{children}</main>
    </div>
  )
}
