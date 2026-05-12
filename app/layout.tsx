import type { Metadata } from 'next'
import { Geist, Geist_Mono, Comfortaa } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
const comfortaa = Comfortaa({
  variable: '--font-comfortaa',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Beehive Studio — Craft your story. Grow your hive.',
  description: 'The professional writing studio where authors write, collaborate, and publish to a community of readers.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} ${comfortaa.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
