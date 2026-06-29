import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { MarketingLanding } from './_components/marketing-landing'
import { JsonLd } from '@/components/seo/json-ld'
import {
  SITE_NAME,
  SITE_SLOGAN,
  SITE_DESCRIPTION,
  absoluteUrl,
  localeAlternates,
} from '@/lib/seo/site'

type Props = { params: Promise<{ locale: string }> }

// ─── SEO (issue #52) ──────────────────────────────────────────────────────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return {
    // Home title should read as the brand, not "Home". Use the absolute form so
    // the "%s · Beehive Books" template does not double the name.
    title: { absolute: `${SITE_NAME} · ${SITE_SLOGAN}` },
    description: SITE_DESCRIPTION,
    alternates: localeAlternates(locale, '/'),
  }
}

export default async function HomePage({ params }: Props) {
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

  // Site-wide Organization + WebSite (with SearchAction) structured data lives
  // on the crawlable site root.
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: absoluteUrl(`/${locale}`),
    logo: absoluteUrl('/icon-512.png'),
    description: SITE_DESCRIPTION,
    slogan: SITE_SLOGAN,
  }
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: absoluteUrl(`/${locale}`),
    description: SITE_DESCRIPTION,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: absoluteUrl(`/${locale}/discover?tab=books&q={search_term_string}`),
      },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <>
      <JsonLd data={orgJsonLd} />
      <JsonLd data={websiteJsonLd} />
      <MarketingLanding locale={locale} />
    </>
  )
}
