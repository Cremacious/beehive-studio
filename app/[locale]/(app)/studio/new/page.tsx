import { headers } from 'next/headers'
import { db } from '@/db'
import { bookTemplates } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getUserPremiumStatus } from '@/lib/premium'
import { BookCreationForm } from './_components/book-creation-form'

export default async function NewBookPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  const [templates, session] = await Promise.all([
    db
      .select({ id: bookTemplates.id, name: bookTemplates.name, genre: bookTemplates.genre })
      .from(bookTemplates)
      .where(eq(bookTemplates.isSystemTemplate, true))
      .orderBy(bookTemplates.name),
    auth.api.getSession({ headers: await headers() }),
  ])

  const isPremium = session?.user ? await getUserPremiumStatus(session.user.id) : false

  return <BookCreationForm locale={locale} templates={templates} isPremium={isPremium} />
}
