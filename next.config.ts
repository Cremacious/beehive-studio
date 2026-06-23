import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const LOCALES = ['en']
const COMMUNITY_ROUTES = [
  ['/hives', '/community/hives'],
  ['/friends', '/community/friends'],
  ['/sparks', '/community/sparks'],
  ['/reading-lists', '/community/reading-lists'],
  ['/clubs', '/community/clubs'],
  ['/bookmarks', '/community/bookmarks'],
]

const nextConfig: NextConfig = {
  // pdfkit (PDF export) bundles fontkit, whose prebuilt ESM build imports an
  // `@swc/helpers` export Turbopack can't resolve. Marking these external makes
  // Node load their CommonJS builds at runtime instead of bundling them.
  serverExternalPackages: ['pdfkit', 'fontkit'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  async redirects() {
    const redirects: Array<{ source: string; destination: string; permanent: boolean }> = []
    for (const locale of LOCALES) {
      for (const [from, to] of COMMUNITY_ROUTES) {
        redirects.push({
          source: `/${locale}${from}`,
          destination: `/${locale}${to}`,
          permanent: true,
        })
        redirects.push({
          source: `/${locale}${from}/:path*`,
          destination: `/${locale}${to}/:path*`,
          permanent: true,
        })
      }
    }
    return redirects
  },
}

export default withNextIntl(nextConfig)
