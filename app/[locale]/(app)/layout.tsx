import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'

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
    <div className="min-h-screen bg-[#141414]">
      {/* AppShell nav — injected when Claude Design UI is ready */}
      <main>{children}</main>
    </div>
  )
}
