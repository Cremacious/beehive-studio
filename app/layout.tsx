import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Comfortaa, Fraunces, Newsreader, JetBrains_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import {
  SITE_NAME,
  SITE_SLOGAN,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_ALT,
  siteUrl,
} from '@/lib/seo/site'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
const comfortaa = Comfortaa({
  variable: '--font-comfortaa',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
})
const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  display: 'swap',
})
const newsreader = Newsreader({
  variable: '--font-newsreader',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
})
const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE_NAME} · ${SITE_SLOGAN}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'technology',
  manifest: '/manifest.webmanifest',
  formatDetection: { telephone: false, email: false, address: false },
  // Default crawl posture: public pages are indexable. Gated route groups
  // (auth / app / community / admin) override this with noindex in their
  // layouts, and visibility-gated pages override per request.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${SITE_NAME} · ${SITE_SLOGAN}`,
    description: SITE_DESCRIPTION,
    url: '/',
    locale: 'en_US',
    images: [
      {
        url: OG_IMAGE_PATH,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        alt: OG_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} · ${SITE_SLOGAN}`,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE_PATH],
  },
}

// Mobile pass (issue #50). viewport-fit=cover lets safe-area-inset-* env()
// values resolve under the notch / home indicator. maximumScale is left
// unset so users can still pinch-zoom (accessibility); iOS auto-zoom on
// focus is prevented by sizing inputs >=16px in globals.css instead.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#262728',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} ${comfortaa.variable} ${fraunces.variable} ${newsreader.variable} ${jetbrainsMono.variable} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
