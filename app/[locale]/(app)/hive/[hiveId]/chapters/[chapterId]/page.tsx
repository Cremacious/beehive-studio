import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/require-auth'
import { getHiveChapterView } from '@/lib/actions/hive-content.actions'
import { HivePageShell } from '../../_components/hive-page-shell'
import { HivePill } from '../../_components/hive-pill'
import type { HiveRole } from '@/lib/hive/permissions'
import { HiveChapterSurface } from './_components/hive-chapter-surface'

const ROLE_TOKEN: Record<HiveRole, string> = {
  OWNER: '--role-owner',
  MODERATOR: '--role-moderator',
  CONTRIBUTOR: '--role-contributor',
  BETA_READER: '--role-reader',
}

const ROLE_LABEL: Record<HiveRole, string> = {
  OWNER: 'Owner',
  MODERATOR: 'Moderator',
  CONTRIBUTOR: 'Contributor',
  BETA_READER: 'Beta Reader',
}

export default async function HiveChapterPage({
  params,
}: {
  params: Promise<{ hiveId: string; chapterId: string; locale: string }>
}) {
  const { hiveId, chapterId, locale } = await params
  const userId = await requireAuth()
  const r = await getHiveChapterView(hiveId, chapterId)
  if (!r.success) notFound()
  const data = r.data

  const isContribution =
    !!data.author && data.author.userId !== data.book.userId
  const ownerSuffix = data.book.ownerUsername
    ? ` by @${data.book.ownerUsername}`
    : ''
  const byline = isContribution
    ? `Written by @${data.author?.username ?? 'unknown'}, a chapter contribution to ${data.book.title}${ownerSuffix}`
    : `Chapter from ${data.book.title}${ownerSuffix}`

  return (
    <HivePageShell
      width="wide"
      title={data.chapter.title}
      subtitle={byline}
      back={{
        href: `/${locale}/hive/${hiveId}/chapters`,
        label: 'chapters',
      }}
      headerSlot={
        <HivePill token={ROLE_TOKEN[data.viewerRole]}>
          {ROLE_LABEL[data.viewerRole]}
        </HivePill>
      }
    >
      <HiveChapterSurface
        data={data}
        hiveId={hiveId}
        chapterId={chapterId}
        locale={locale}
        viewerUserId={userId}
      />
    </HivePageShell>
  )
}
