import type { MetadataRoute } from 'next'
import { SITE_NAME, SITE_DESCRIPTION } from '@/lib/seo/site'

/**
 * Web app manifest (issue #52 + the mobile pass, issue #50).
 *
 * Icons are generated from the brand logo by scripts/generate-brand-icons.mjs
 * (public/icon-192.png + public/icon-512.png). Colors match the app shell
 * (#262728) used by the root viewport themeColor.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: 'Beehive',
    description: SITE_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#262728',
    theme_color: '#262728',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
