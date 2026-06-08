import { redirect } from 'next/navigation'
import { getNotificationPreferencesAction } from '@/lib/notifications/get-preferences'
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
    <main className="max-w-3xl mx-auto px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1
          className="text-2xl font-bold"
          style={{
            color: 'var(--brand)',
            fontFamily: 'var(--font-comfortaa)',
          }}
        >
          Notification preferences
        </h1>
        <p className="text-sm text-[var(--canvas-dark-ink-muted)] mt-2">
          Choose which notifications you want to receive.
        </p>
      </header>
      <NotificationPreferencesForm
        initialOptedOutTypes={result.data.optedOutTypes}
      />
    </main>
  )
}
