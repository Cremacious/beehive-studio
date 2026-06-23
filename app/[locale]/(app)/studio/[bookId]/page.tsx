import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getBookAction } from '@/lib/actions/book.actions'
import { getBinderTreeAction } from '@/lib/actions/binder.actions'
import { getBookHive } from '@/lib/hive/get-book-hive'
import { isBookOverflow } from '@/lib/billing/book-overflow'
import { getUserPremiumStatus } from '@/lib/premium'
import { BookEditorProvider } from './_components/book-editor-provider'
import { StudioShell } from './_components/studio-shell'
import { ErrorToasts } from './_components/error-toasts'

type Props = {
  params: Promise<{ locale: string; bookId: string }>
}

export default async function BookEditorPage({ params }: Props) {
  const { bookId, locale } = await params

  let bookResult: Awaited<ReturnType<typeof getBookAction>>
  let binderResult: Awaited<ReturnType<typeof getBinderTreeAction>>
  let bookHive: Awaited<ReturnType<typeof getBookHive>>

  try {
    ;[bookResult, binderResult, bookHive] = await Promise.all([
      getBookAction(bookId),
      getBinderTreeAction(bookId),
      getBookHive(bookId),
    ])
  } catch {
    notFound()
  }

  if (!bookResult!.success || !binderResult!.success) notFound()

  const session = await auth.api.getSession({ headers: await headers() })
  const [bookOverflow, isPremium] = session?.user
    ? await Promise.all([
        isBookOverflow(session.user.id, bookId),
        getUserPremiumStatus(session.user.id),
      ])
    : [false, false]

  return (
    <BookEditorProvider
      bookId={bookId}
      bookTitle={bookResult!.data.title}
      locale={locale}
      initialBinderItems={binderResult!.data}
      bookOverflow={bookOverflow}
      bookHive={bookHive!}
      currentUserId={session?.user?.id ?? null}
      isPremium={isPremium}
    >
      <StudioShell />
      <ErrorToasts />
    </BookEditorProvider>
  )
}
