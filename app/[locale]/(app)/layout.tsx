import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { AppNav } from './_components/app-nav'

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) redirect(`/${locale}/sign-in`)

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, session.user.id),
    columns: { onboardingComplete: true },
  })

  if (!profile?.onboardingComplete) redirect(`/${locale}/onboarding`)

  return (
    <div className="min-h-screen bg-[#141414] flex flex-col">
      <AppNav locale={locale} user={session.user} />
      <main className="flex-1 flex flex-col pt-1.5">{children}</main>
    </div>
  )
}
