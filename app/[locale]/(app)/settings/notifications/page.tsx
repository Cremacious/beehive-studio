import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getNotificationPreferencesAction } from '@/lib/notifications/get-preferences'
import { PageHead } from '@/components/community/page-head'
import { NotificationPreferencesForm } from './_components/notification-preferences-form'

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const result = await getNotificationPreferencesAction()
  if (!result.success) redirect(`/${locale}/sign-in`)

  return (
    <main className="cm-wrap w-3xl">
      <PageHead
        title="Notification preferences"
        subtitle="Choose what reaches you. Toggles save the moment you flip them. On means you're receiving."
      />
      <NotificationPreferencesForm
        initialOptedOutTypes={result.data.optedOutTypes}
      />

      <div className="mt-8 pt-6" style={{ borderTop: '1px solid oklch(1 0 0 / 0.06)' }}>
        <Link
          href={`/${locale}/settings/account`}
          className="text-[13.5px] hover:underline underline-offset-4 transition-colors"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          Account settings (danger zone)
        </Link>
      </div>
    </main>
  )
}
