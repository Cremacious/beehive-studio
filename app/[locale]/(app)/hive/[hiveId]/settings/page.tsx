import { notFound } from 'next/navigation'
import { getHiveAction } from '@/lib/actions/hive.actions'
import { HiveSettingsForm } from '../_components/hive-settings-form'

export default async function HiveSettingsPage({ params }: { params: Promise<{ locale: string; hiveId: string }> }) {
  const { locale, hiveId } = await params
  const result = await getHiveAction(hiveId).catch(() => null)
  if (!result?.success) notFound()

  const { hive, isOwner } = result.data

  if (!isOwner) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-muted-foreground">
        <h2 className="text-lg font-medium text-foreground mb-2">Settings</h2>
        <p>Settings is only available to the hive owner.</p>
      </div>
    )
  }

  return (
    <HiveSettingsForm
      hiveId={hive.id}
      locale={locale}
      initial={{
        name: hive.name,
        description: hive.description ?? '',
        visibility: hive.visibility,
        discoverable: hive.discoverable,
      }}
    />
  )
}
