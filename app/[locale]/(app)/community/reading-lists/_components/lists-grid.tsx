'use client'

import { ListCard, type ListCardData } from '@/components/list/list-card'
import { ListGhostCard } from '@/components/list/list-ghost-card'
import {
  pickListGhosts,
  type ListGhostContext,
} from '@/lib/lists/pick-list-ghosts'
import { useDismissedListGhosts } from '@/lib/lists/use-dismissed-list-ghosts'

type Props = {
  rows: ListCardData[]
  ghostContext: Omit<ListGhostContext, 'dismissedKeys'>
  locale: string
  trendingHint: { title: string; curator: string } | null
  smallestOwnedListId: string | null
  highestFollowerListId: string | null
}

/**
 * Hub grid client component. Interleaves real `<ListCard>` rows with
 * `<ListGhostCard>` nudges picked by `pickListGhosts`. Ghosts are appended
 * after real cards (matches /sparks + /hives precedent — grid simply renders
 * reals first, then ghosts fill to TARGET_TOTAL).
 *
 * Dismissed ghosts are filtered by the pure helper; the localStorage hook
 * surfaces a stable Set into the picker.
 */
export function ListsGrid({
  rows,
  ghostContext,
  locale,
  trendingHint,
  smallestOwnedListId,
  highestFollowerListId,
}: Props) {
  const { dismissed, dismiss } = useDismissedListGhosts()

  const ghosts = pickListGhosts({
    ...ghostContext,
    dismissedKeys: dismissed,
  })

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {rows.map((row) => (
        <ListCard
          key={row.id}
          list={row}
          size="md"
          showSourceTag={true}
          href={`/${locale}/community/reading-lists/${row.id}`}
        />
      ))}
      {ghosts.map((variant, i) => (
        <ListGhostCard
          key={`ghost-${variant}-${i}`}
          variant={variant}
          locale={locale}
          onDismiss={() => dismiss(variant)}
          trendingHint={
            variant === 'trending-from-network' ? trendingHint : null
          }
          smallestOwnedListId={
            variant === 'themed-list-nudge' ? smallestOwnedListId : null
          }
          highestFollowerListId={
            variant === 'share-list-link' ? highestFollowerListId : null
          }
        />
      ))}
    </div>
  )
}
