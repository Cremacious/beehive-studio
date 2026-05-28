import { permanentRedirect } from 'next/navigation'

type Props = { params: Promise<{ locale: string; bookId: string }> }

export default async function DiscoverBookRedirect({ params }: Props) {
  const { locale, bookId } = await params
  permanentRedirect(`/${locale}/books/${bookId}`)
}
