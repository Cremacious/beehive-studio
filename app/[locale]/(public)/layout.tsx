import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { AppNav } from '../(app)/_components/app-nav'
import { AppFooter } from '@/components/app-footer'

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const session = await auth.api.getSession({ headers: await headers() })

  const profile = session?.user
    ? await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, session.user.id),
        columns: { username: true },
      })
    : null

  // Public routes don't gate on auth — guests can still browse PUBLIC books,
  // /discover, etc. When a session exists we render the AppNav so authed users
  // get the consistent top chrome they have everywhere else in the app. Guests
  // get the bare page (no nav) for now — a guest-mode nav with Sign in / Sign
  // up CTAs is a follow-up if it becomes worth it.
  //
  // When the AppNav is shown, it includes a fixed mobile bottom tab bar (56px +
  // safe area). Reserve that space at the bottom on mobile — mirroring
  // (app)/layout.tsx — so the bar never covers the last of the page content
  // (e.g. the next-chapter nav, comments). Guests have no bar, so no padding.
  return (
    <div
      className={`min-h-screen bg-[#262728] flex flex-col${
        session?.user ? ' max-md:pb-[calc(56px+env(safe-area-inset-bottom))]' : ''
      }`}
    >
      {session?.user && (
        <AppNav locale={locale} user={session.user} username={profile?.username ?? null} />
      )}
      <main className="flex flex-col">{children}</main>
      <AppFooter />
    </div>
  )
}
