import { permanentRedirect } from 'next/navigation'

export default async function Page({
  params,
}: { params: Promise<{ locale: string; sparkId: string }> }) {
  const { locale, sparkId } = await params
  permanentRedirect(`/${locale}/community/sparks/${sparkId}`)
}
