import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { MarketingLanding } from './_components/marketing-landing'

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  // The landing page is for logged-out visitors only. Signed-in users have no
  // use for the marketing page, so send them straight to their studio. This
  // also guarantees the app nav (which the (public) layout renders only for
  // authed users) never appears here — the landing ships its own top nav with
  // just Sign In + Start Writing.
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) {
    redirect(`/${locale}/studio`)
  }

  return <MarketingLanding locale={locale} />
}
