'use client'

import { SparkCard } from '../../../discover/_components/spark-card'
import { GhostCard } from './ghost-card'
import { pickGhosts } from './pick-ghosts'
import { useDismissedGhosts } from './use-dismissed-ghosts'
import type { CommunitySparkRow } from '@/lib/actions/sparks-hub.actions'
import type { SparksTab } from './sparks-tab-strip'
import type { PromptTemplate } from '@/lib/sparks/prompt-templates'

type Props = {
  sparks: CommunitySparkRow[]
  tab: SparksTab
  locale: string
  bucketCounts: { all: number; yours: number; following: number; friends: number; entered: number }
  promptTemplate: PromptTemplate
  trendingSpark: { id: string; title: string; entryCount: number; deadline: Date | string | null } | null
}

export function SparksGrid({ sparks, tab, locale, bucketCounts, promptTemplate, trendingSpark }: Props) {
  const { dismissed, dismiss } = useDismissedGhosts()

  const ghosts = pickGhosts({
    tab,
    realCount: sparks.length,
    followingCount: bucketCounts.following,
    friendsCount: bucketCounts.friends,
    enteredCount: bucketCounts.entered,
    ownCount: bucketCounts.yours,
    dismissed: new Set(dismissed),
  })

  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        alignItems: 'stretch',
      }}
    >
      {sparks.map(s => (
        <SparkCard key={s.id} spark={s} locale={locale} sourceTag={s.source} size="md" />
      ))}
      {ghosts.map((variant, i) => (
        <GhostCard
          key={`ghost-${variant}-${i}`}
          variant={variant}
          locale={locale}
          onDismiss={dismiss}
          promptTemplate={promptTemplate}
          trendingSpark={trendingSpark}
        />
      ))}
    </div>
  )
}
