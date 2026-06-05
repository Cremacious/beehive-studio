import { permanentRedirect } from 'next/navigation'

export default async function Page({
  params,
}: { params: Promise<{ locale: string; sparkId: string; entryId: string }> }) {
  const { locale, sparkId, entryId } = await params
  permanentRedirect(`/${locale}/sparks/${sparkId}/entry/${entryId}`)
}
