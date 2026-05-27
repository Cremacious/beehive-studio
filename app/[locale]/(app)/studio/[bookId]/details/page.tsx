import { notFound } from 'next/navigation'
import { getBookDetailsAction } from '@/lib/actions/book.actions'
import { getUserPremiumStatus } from '@/lib/premium'
import { requireAuth } from '@/lib/require-auth'
import { BookDetailsForm } from './_components/book-details-form'

export default async function BookDetailsPage({
  params,
}: {
  params: Promise<{ locale: string; bookId: string }>
}) {
  const { locale, bookId } = await params

  const userId = await requireAuth()
  const [detailsResult, isPremium] = await Promise.all([
    getBookDetailsAction(bookId),
    getUserPremiumStatus(userId),
  ])

  if (!detailsResult.success) notFound()

  return (
    <BookDetailsForm
      locale={locale}
      bookId={bookId}
      initial={detailsResult.data}
      isPremium={isPremium}
    />
  )
}
