import { PageHead } from '@/components/community/page-head'
import { DeleteAccountSection } from './_components/delete-account-section'

export const metadata = { title: 'Account settings · Beehive Studio' }

export default async function AccountSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  return (
    <main className="cm-wrap w-3xl">
      <PageHead
        title="Account"
        subtitle="Manage your account settings and danger zone actions."
      />
      <DeleteAccountSection locale={locale} />
    </main>
  )
}
