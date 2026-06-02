import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { AppNav } from '../(app)/_components/app-nav'

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const session = await auth.api.getSession({ headers: await headers() })

  // Public routes don't gate on auth — guests can still browse PUBLIC books,
  // /discover, etc. When a session exists we render the AppNav so authed users
  // get the consistent top chrome they have everywhere else in the app. Guests
  // get the bare page (no nav) for now — a guest-mode nav with Sign in / Sign
  // up CTAs is a follow-up if it becomes worth it.
  return (
    <div className="min-h-screen bg-[#262728] flex flex-col">
      {session?.user && <AppNav locale={locale} user={session.user} />}
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  )
}
