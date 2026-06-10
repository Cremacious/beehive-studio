import Link from 'next/link'

type Profile = {
  username: string | null
  displayName: string | null
}

type Props = {
  chapterAuthor: Profile
  bookAuthor: Profile
  bookTitle: string
  locale: string
}

function profileLabel(p: Profile): string {
  if (p.username) return `@${p.username}`
  if (p.displayName) return p.displayName
  return 'Unknown'
}

function profileHref(locale: string, p: Profile): string | null {
  if (p.username) return `/${locale}/u/${p.username}`
  return null
}

export function ChapterContributionByline({
  chapterAuthor,
  bookAuthor,
  bookTitle,
  locale,
}: Props) {
  const chapterHref = profileHref(locale, chapterAuthor)
  const bookHref = profileHref(locale, bookAuthor)

  const chapterAuthorEl = chapterHref ? (
    <Link href={chapterHref} className="hover:text-white transition-colors">
      {profileLabel(chapterAuthor)}
    </Link>
  ) : (
    <span>{profileLabel(chapterAuthor)}</span>
  )

  const bookAuthorEl = bookHref ? (
    <Link href={bookHref} className="hover:text-white transition-colors">
      {profileLabel(bookAuthor)}
    </Link>
  ) : (
    <span>{profileLabel(bookAuthor)}</span>
  )

  return (
    <p className="text-sm text-muted-foreground italic mb-6">
      Written by {chapterAuthorEl}
      {', a chapter contribution to '}
      <span className="not-italic">{bookTitle}</span>{' '}
      by {bookAuthorEl}
    </p>
  )
}
