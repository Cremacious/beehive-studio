import { redirect } from 'next/navigation'
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
        subtitle="Choose what reaches you. Toggles save the moment you flip them — on means you're receiving."
      />
      <NotificationPreferencesForm
        initialOptedOutTypes={result.data.optedOutTypes}
      />
    </main>
  )
}
