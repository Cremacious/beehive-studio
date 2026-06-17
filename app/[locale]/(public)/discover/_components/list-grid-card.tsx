// T5 of reading-lists hub redesign. Thin re-export of the shared V2 ListCard
// at size='md'. Source-tag pill hidden on /discover surfaces (no source
// signal — viewer is browsing all discoverable lists).
import type { ListCard as DiscoverListCardData } from '@/lib/actions/discover-lists.actions'
import { GENRE_LABEL, isValidGenre } from '@/lib/discover/genres'
import { ListCard, type ListCardData } from '@/components/list/list-card'

type Props = {
  list: DiscoverListCardData
  locale: string
}

function adapt(list: DiscoverListCardData): ListCardData {
  return {
    id: list.id,
    title: list.title,
    description: list.description,
    genre:
      list.genre && isValidGenre(list.genre) ? GENRE_LABEL[list.genre] : null,
    bookCount: list.bookCount,
    followerCount: list.followerCount,
    sourceTag: null,
    curator: {
      userId: list.ownerUserId,
      username: list.ownerUsername,
      displayName: list.ownerDisplayName,
      avatarUrl: list.ownerAvatarUrl,
    },
    coverPreviews: list.bookCoverPreviews
      .filter((p) => p.bookId !== null)
      .map((p) => ({
        bookId: (p.bookId as string) ?? '',
        coverUrl: p.coverUrl,
      })),
  }
}

export function ListGridCard({ list, locale }: Props) {
  return (
    <ListCard
      list={adapt(list)}
      size="md"
      showSourceTag={false}
      href={`/${locale}/community/reading-lists/${list.id}`}
    />
  )
}
