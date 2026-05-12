import { notFound } from 'next/navigation'
import { getHiveAction } from '@/lib/actions/hive.actions'
import { HiveSidebar } from './_components/hive-sidebar'

export default async function HiveLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string; hiveId: string }>
}) {
  const { locale, hiveId } = await params
  const result = await getHiveAction(hiveId).catch(() => null)
  if (!result?.success) notFound()

  const { hive, isOwner, isEditor } = result.data

  return (
    <div className="flex flex-1 overflow-hidden h-[calc(100vh-56px)]">
      <HiveSidebar
        hiveId={hiveId}
        locale={locale}
        hiveName={hive.name}
        isOwner={isOwner}
        isEditor={isEditor}
      />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
