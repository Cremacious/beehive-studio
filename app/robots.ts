import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/seo/site'

/**
 * robots.txt (issue #52).
 *
 * Public, crawlable surfaces: the landing page, pricing, legal pages, the book
 * reader (/<locale>/books/...), author profiles (/<locale>/u/...), and
 * /<locale>/discover. Everything else is either auth-gated (so a crawler is
 * redirected to sign-in and gets no content) or internal, and is disallowed.
 *
 * Locale-prefixed paths use a `*` wildcard so the single rule covers every
 * locale once more are added. `/admin` and `/api` are locale-free.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl()
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/api/',
          '/*/studio',
          '/*/settings',
          '/*/community',
          '/*/hive',
          '/*/welcome',
          '/*/redeem',
          '/*/support',
          '/*/docs',
          '/*/friend-invite',
          '/*/onboarding',
          '/*/sign-in',
          '/*/sign-up',
          '/*/forgot-password',
          '/*/reset-password',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
