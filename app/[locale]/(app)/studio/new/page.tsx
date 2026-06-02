import { db } from '@/db'
import { bookTemplates } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { BookCreationForm } from './_components/book-creation-form'

export default async function NewBookPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  const templates = await db
    .select({ id: bookTemplates.id, name: bookTemplates.name, genre: bookTemplates.genre })
    .from(bookTemplates)
    .where(eq(bookTemplates.isSystemTemplate, true))
    .orderBy(bookTemplates.name)

  return (
    <div
      className="flex-1 flex flex-col"
      style={{ background: '#242526' }}
    >
      <BookCreationForm locale={locale} templates={templates} />
    </div>
  )
}
