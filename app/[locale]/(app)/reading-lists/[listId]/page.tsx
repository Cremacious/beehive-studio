import { notFound } from 'next/navigation'
import { getListAction } from '@/lib/actions/reading-lists.actions'
import { getOptionalUserId } from '@/lib/require-auth'
import { ListDetailHeader } from '../_components/list-detail-header'
import { BookList } from '../_components/book-list'
import { AddBookCTA } from '../_components/add-book-cta'

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

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 sm:px-6">
      <ListDetailHeader
        list={list}
        owner={owner}
        isFollowing={isFollowing}
        isOwner={isOwner}
        locale={locale}
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
