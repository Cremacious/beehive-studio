import { notFound } from 'next/navigation'
import {
  getClubAction,
  getClubBooksAction,
  type ClubBookRow,
} from '@/lib/actions/book-clubs.actions'
import { PageHead } from '@/components/community/page-head'
import { QueueManager } from './_components/queue-manager'

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; clubId: string }>
}) {
  const { locale, clubId } = await params

  const [clubResult, booksResult] = await Promise.all([
    getClubAction(clubId),
    getClubBooksAction({ clubId }),
  ])
  if (!clubResult.success) notFound()
  if (!booksResult.success) notFound()

  const club = clubResult.data.club
  const viewerRole = clubResult.data.viewerRole
  const canManage = viewerRole === 'OWNER' || viewerRole === 'MODERATOR'

  const rows = booksResult.data.rows
  const current = rows.find((r) => r.status === 'CURRENT') ?? null
  const queue: ClubBookRow[] = rows
    .filter((r) => r.status === 'QUEUE')
    .sort((a, b) => a.order - b.order)
  const past: ClubBookRow[] = rows
    .filter((r) => r.status === 'PAST')
    .sort((a, b) => {
      const aT = a.finishedAt ? a.finishedAt.getTime() : 0
      const bT = b.finishedAt ? b.finishedAt.getTime() : 0
      return bT - aT
    })

  const subtitleParts: string[] = []
  if (current) subtitleParts.push('1 current')
  subtitleParts.push(`${queue.length} queued`)
  if (past.length > 0) subtitleParts.push(`${past.length} past`)

  return (
    <main className="cm-main">
      <div className="cm-wrap w-3xl">
        <PageHead
          back={{
            href: `/${locale}/community/clubs/${clubId}`,
            label: club.name,
          }}
          title="Reading queue"
          subtitle={subtitleParts.join(' · ')}
        />
        <QueueManager
          clubId={clubId}
          canManage={canManage}
          initialCurrent={current}
          initialQueue={queue}
          initialPast={past}
        />
      </div>
    </main>
  )
}
