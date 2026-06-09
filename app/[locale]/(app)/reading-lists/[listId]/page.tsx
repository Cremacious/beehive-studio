import { notFound } from 'next/navigation'
import { getListAction } from '@/lib/actions/reading-lists.actions'
import { getOptionalUserId } from '@/lib/require-auth'
import { ListDetailHeader } from '../_components/list-detail-header'
import { BookList } from '../_components/book-list'
import { AddBookCTA } from '../_components/add-book-cta'
import { BackLinkBadge } from '@/components/community/back-link-badge'

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ locale: string; listId: string }>
}) {
  const { locale, listId } = await params
  const viewerId = await getOptionalUserId()
  const result = await getListAction(listId)
  if (!result.success) notFound()

  const { list, owner, isFollowing, books } = result.data
  const isOwner = viewerId === list.userId
  const canMutate = isOwner && list.kind === 'CUSTOM'
  const readCount = books.filter((b) => b.isRead).length

  return (
    <main className="cm-wrap w-5xl">
      <BackLinkBadge href={`/${locale}/reading-lists`} label="reading lists" />
      <ListDetailHeader
        list={list}
        owner={owner}
        isFollowing={isFollowing}
        isOwner={isOwner}
        locale={locale}
        readCount={readCount}
      />
      {canMutate && <AddBookCTA listId={list.id} />}
      <BookList
        books={books}
        listId={list.id}
        isOwner={canMutate}
        locale={locale}
      />
    </main>
  )
}
