'use client'

import { useState } from 'react'
import { HiveHubCard } from './hive-hub-card'
import { HiveGhostCard } from './hive-ghost-card'
import { pickHiveGhosts } from './pick-hive-ghosts'
import { useDismissedHiveGhosts } from './use-dismissed-hive-ghosts'
import { CreateHiveModal } from '@/app/[locale]/(app)/studio/_components/create-hive-modal'
import type { CommunityHiveRow } from '@/lib/actions/hives-hub.actions'

type HivesTab = 'all' | 'yours' | 'member' | 'suggested'

type Props = {
  hives: CommunityHiveRow[]
  tab: HivesTab
  locale: string
  bucketCounts: { all: number; yours: number; member: number; suggested: number }
  ghostContext: {
    hasSoloHive: boolean
    hasActiveWordGoal: boolean
    hasRecentBuzz: boolean
  }
  trendingHive: { id: string; name: string } | null
  smallestOwnedHiveId: string | null
  anyOwnedHiveId: string | null
}

export function HivesGrid({
  hives,
  tab,
  locale,
  bucketCounts,
  ghostContext,
  trendingHive,
  smallestOwnedHiveId,
  anyOwnedHiveId,
}: Props) {
  const { dismissed, dismiss } = useDismissedHiveGhosts()
  const [createOpen, setCreateOpen] = useState(false)
  const [createStandalone, setCreateStandalone] = useState(false)

  const openCreate = (standalone: boolean) => {
    setCreateStandalone(standalone)
    setCreateOpen(true)
  }

  const ghosts = pickHiveGhosts({
    tab,
    realCount: hives.length,
    ownCount: bucketCounts.yours,
    hasSoloHive: ghostContext.hasSoloHive,
    hasActiveWordGoal: ghostContext.hasActiveWordGoal,
    hasRecentBuzz: ghostContext.hasRecentBuzz,
    dismissed: new Set(dismissed),
  })

  return (
    <>
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
          alignItems: 'stretch',
        }}
      >
        {hives.map((h) => (
          <HiveHubCard key={h.id} hive={h} locale={locale} />
        ))}
        {ghosts.map((variant, i) => (
          <HiveGhostCard
            key={`ghost-${variant}-${i}`}
            variant={variant}
            locale={locale}
            onDismiss={dismiss}
            onCreate={
              variant === 'create-hive'
                ? () => openCreate(false)
                : variant === 'try-standalone'
                ? () => openCreate(true)
                : undefined
            }
            trendingHive={variant === 'join-open' ? trendingHive : null}
            hiveId={
              variant === 'invite-collaborators'
                ? smallestOwnedHiveId
                : variant === 'set-word-goal' || variant === 'set-buzz-up'
                ? anyOwnedHiveId
                : null
            }
          />
        ))}
      </div>
      <CreateHiveModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialPath={createStandalone ? 'standalone' : undefined}
      />
    </>
  )
}
