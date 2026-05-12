import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* AppShell nav — injected when Claude Design UI is ready */}
      <main>{children}</main>
    </div>
  )
}
