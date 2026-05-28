import { permanentRedirect } from 'next/navigation'

type Props = { params: Promise<{ locale: string; bookId: string; chapterId: string }> }

export default async function DiscoverChapterReaderRedirect({ params }: Props) {
  const { locale, bookId, chapterId } = await params
  permanentRedirect(`/${locale}/books/${bookId}/read/${chapterId}`)
}
