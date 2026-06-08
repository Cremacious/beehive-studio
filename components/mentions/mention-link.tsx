import Link from 'next/link'

type Props = { username: string; userId?: string }

export function MentionLink({ username, userId }: Props) {
  return (
    <Link
      href={`/u/${username}`}
      className="mention"
      data-mention-user-id={userId ?? undefined}
    >
      @{username}
    </Link>
  )
}
